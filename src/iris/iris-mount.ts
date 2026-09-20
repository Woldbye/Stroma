import { Renderer } from 'ogl';
import { createIrisScene, type IrisScene, type IrisSceneOptions, type LookKey } from './iris-scene';
import { IRIS_PALETTES, type PaletteName } from './iris-palettes';

/* Mounting the iris in a page: one WebGL2 renderer on an element, the scene on it, and the
   frame loop that drives it. The demo and the harness both build on this, so neither carries
   the other's setup. */

export type IrisMount = {
  renderer: Renderer;
  iris: IrisScene;
  /** Sets the canvas to a square of this many CSS pixels and re-bakes. */
  resize: (size: number) => void;
  /** Releases the WebGL context. */
  dispose: () => void;
};

export function mountIris(el: HTMLElement, options: IrisSceneOptions = {}): IrisMount {
  const renderer = new Renderer({
    webgl: 2,
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    dpr: window.devicePixelRatio || 1,
  });
  el.appendChild(renderer.gl.canvas);
  const iris = createIrisScene(renderer, options);

  if (import.meta.env.DEV) {
    // The scene on the window in development, so a script can drive frames while the tab is
    // hidden and the animation loop is paused.
    (window as Window & { stroma?: { iris: IrisScene; renderer: Renderer } }).stroma = {
      iris,
      renderer,
    };
  }

  return {
    renderer,
    iris,
    resize: (size) => {
      renderer.setSize(size, size);
      iris.resized();
    },
    dispose: () => renderer.gl.getExtension('WEBGL_lose_context')?.loseContext(),
  };
}

/** Applies a palette preset's knobs to the scene. */
export function applyPalette(iris: IrisScene, name: PaletteName) {
  for (const [key, value] of Object.entries(IRIS_PALETTES[name])) {
    iris.setLook(key as LookKey, value);
  }
}

/** Runs a frame callback on animation frames with the elapsed seconds, clamped so a tab that
    was hidden does not step the pupil by a whole absence. Returns the stop function. */
export function runFrames(frame: (dt: number) => void): () => void {
  let rafId = 0;
  let last = 0;
  const loop = (t: number) => {
    rafId = requestAnimationFrame(loop);
    const dt = last === 0 ? 0 : Math.min((t - last) * 0.001, 0.05);
    last = t;
    frame(dt);
  };
  rafId = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(rafId);
}
