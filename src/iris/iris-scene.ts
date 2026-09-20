import { Mesh, Program, Renderer, RenderTarget, Triangle } from 'ogl';
import {
  IRIS_BAKE_FRAG,
  IRIS_BAKE_KEYS,
  IRIS_DEFAULTS,
  IRIS_PRESENT_FRAG,
  IRIS_VERT,
} from './iris-shaders';
import { assertProgramLinked } from './assert-program-linked';

export type IrisSceneOptions = {
  /** Fade-in length; 0 draws at full alpha from the first frame (the harness). */
  fadeInMs?: number;
};

export type LookKey = keyof typeof IRIS_DEFAULTS;

export type IrisScene = {
  /**
   * Eases the look toward its targets and integrates the fade. Returns true once every value
   * is at rest and has been drawn at rest, so the caller can skip the render.
   */
  tick(dt: number, animated: boolean): boolean;
  /** Re-bakes if the structure or size changed, then draws the current state to the canvas. */
  render(): void;
  /** Runs after the renderer has resized its canvas. */
  resized(): void;
  /** Sets a knob's target; the tick eases the live value toward it. */
  setLook(key: LookKey, value: number | readonly number[]): void;
  /** Forces the next render to re-bake (the harness times the bake this way). */
  invalidate(): void;
};

const FADE_IN_MS = 600;
const SETTLE_EPS = 1e-4;

/* The bake is supersampled and mip-mapped, and the present pass reads it trilinearly, so what
   reaches the screen is band-limited to the screen. The cap keeps a large iris on a dense
   screen from baking millions of pixels; the present pass upscales past it. */
const BAKE_SCALE = 2;
const BAKE_MAX = 2048;

type Look = Record<LookKey, number | number[]>;

const cloneLook = (): Look =>
  Object.fromEntries(
    Object.entries(IRIS_DEFAULTS).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])
  ) as Look;

const BAKE_KEYS = new Set<LookKey>(IRIS_BAKE_KEYS);

/**
 * The iris scene: the bake and present programs, the render target between them, the eased
 * look and the settle check, independent of any component so the harness can drive the same
 * pipeline. Nothing in `tick` or `render` allocates.
 */
export function createIrisScene(r: Renderer, options: IrisSceneOptions = {}): IrisScene {
  const fadeInMs = options.fadeInMs ?? FADE_IN_MS;
  const gl = r.gl;
  gl.clearColor(0, 0, 0, 0);

  // Forces one frame when something outside the eased values changes (resize).
  let dirty = true;
  // The bake runs on the first frame, then only when a baked knob or the size changes.
  let bakeDirty = true;

  const resolution = [gl.canvas.width, gl.canvas.height];
  const bakeResolution = [1, 1];

  /* Every knob eases toward a target in the tick rather than being written as a constant, so
     a later per-state table only has to move the targets. Vectors are eased in place and the
     shaders read the same array; scalars are written to their uniforms. Both programs receive
     every knob; ogl ignores the ones a shader does not declare. */
  const look = cloneLook();
  const lookTarget = cloneLook();
  const LOOK_KEYS = Object.keys(look) as LookKey[];
  const lookUniforms = () => Object.fromEntries(LOOK_KEYS.map((k) => [k, { value: look[k] }]));

  const geometry = new Triangle(gl);

  /* The baked iris, square with the disc inscribed: two textures, the structure and the
     dynamic fields the present pass scales with the pupil. ogl's render target never builds
     mip levels itself; `bake` generates them after each draw, and the trilinear filter here is
     what the present pass then reads through. */
  const irisTarget = new RenderTarget(gl, {
    width: 2,
    height: 2,
    color: 2,
    depth: false,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
  });

  const bakeProgram = new Program(gl, {
    vertex: IRIS_VERT,
    fragment: IRIS_BAKE_FRAG,
    transparent: false,
    cullFace: false,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...lookUniforms(),
      uResolution: { value: bakeResolution },
    },
  });
  assertProgramLinked(gl, bakeProgram, 'iris bake');
  const bakeMesh = new Mesh(gl, { geometry, program: bakeProgram });

  const presentProgram = new Program(gl, {
    vertex: IRIS_VERT,
    fragment: IRIS_PRESENT_FRAG,
    transparent: true,
    cullFace: false,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...lookUniforms(),
      uResolution: { value: resolution },
      uAlpha: { value: fadeInMs === 0 ? 1 : 0 },
      uIris: { value: irisTarget.textures[0] },
      uIrisDynamics: { value: irisTarget.textures[1] },
    },
  });
  assertProgramLinked(gl, presentProgram, 'iris present');
  const presentMesh = new Mesh(gl, { geometry, program: presentProgram });

  const mountTime = performance.now();

  const atRest = (dt: number, animated: boolean): boolean => {
    // An animated iris draws every frame; only a still one can come to rest.
    if (animated || dt === 0) return false;
    // A resize changes no eased value, so it needs an explicit frame.
    if (dirty) {
      dirty = false;
      return false;
    }
    if (presentProgram.uniforms.uAlpha.value < 1) return false;
    for (const key of LOOK_KEYS) {
      const value = look[key];
      const target = lookTarget[key];
      if (typeof value === 'number') {
        if (Math.abs((target as number) - value) > SETTLE_EPS) return false;
      } else {
        for (let i = 0; i < value.length; i++) {
          if (Math.abs((target as number[])[i] - value[i]) > SETTLE_EPS) return false;
        }
      }
    }
    return true;
  };

  /* The values are at rest before they have been drawn at rest: the frame that first reaches
     the target must still render, or the canvas keeps the last in-flight frame. */
  let drawnAtRest = false;

  const bake = () => {
    const canvasSize = Math.min(gl.canvas.width, gl.canvas.height);
    if (canvasSize === 0) return;
    const size = Math.min(BAKE_MAX, canvasSize * BAKE_SCALE);
    /* In-place resize: setSize re-uploads storage on the existing GL objects and no-ops when
       unchanged, so repeated resizes never leak GPU resources. */
    irisTarget.setSize(size, size);
    bakeResolution[0] = size;
    bakeResolution[1] = size;
    r.render({ scene: bakeMesh, target: irisTarget });
    // Through ogl's bind so its texture-unit cache stays in step with the GL state.
    for (const texture of irisTarget.textures) {
      texture.bind();
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    bakeDirty = false;
  };

  return {
    tick(dt, animated) {
      /* Ease the look toward its target; a value within the settle threshold snaps, so the
         bake stops re-running once a transition has effectively landed. */
      const lk = Math.min(1, dt * 8);
      for (const key of LOOK_KEYS) {
        const value = look[key];
        const target = lookTarget[key];
        let moved = false;
        if (typeof value === 'number') {
          const t = target as number;
          if (Math.abs(t - value) > SETTLE_EPS) {
            const next = value + (t - value) * lk;
            look[key] = next;
            bakeProgram.uniforms[key].value = next;
            presentProgram.uniforms[key].value = next;
            moved = true;
          }
        } else {
          const t = target as number[];
          for (let i = 0; i < value.length; i++) {
            if (Math.abs(t[i] - value[i]) > SETTLE_EPS) {
              value[i] += (t[i] - value[i]) * lk;
              moved = true;
            }
          }
        }
        if (moved && BAKE_KEYS.has(key)) bakeDirty = true;
      }

      if (fadeInMs > 0) {
        presentProgram.uniforms.uAlpha.value = Math.min(
          (performance.now() - mountTime) / fadeInMs,
          1
        );
      }

      const rest = atRest(dt, animated);
      const skip = rest && drawnAtRest;
      drawnAtRest = rest;
      return skip;
    },
    render() {
      if (bakeDirty) bake();
      r.render({ scene: presentMesh });
    },
    resized() {
      resolution[0] = gl.canvas.width;
      resolution[1] = gl.canvas.height;
      dirty = true;
      bakeDirty = true;
    },
    setLook(key, value) {
      const target = lookTarget[key];
      if (typeof target === 'number') {
        lookTarget[key] = value as number;
      } else {
        const v = value as readonly number[];
        for (let i = 0; i < target.length; i++) target[i] = v[i];
      }
    },
    invalidate() {
      bakeDirty = true;
    },
  };
}
