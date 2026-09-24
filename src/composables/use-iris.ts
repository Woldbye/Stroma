import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { DrawnAs, Light } from '@/demo/demo-state';
import type { EyeName, Knob } from '@/demo/iris-eyes';
import { layerKnobs, type LayerId } from '@/demo/iris-layers';
import { applyPalette, mountIris, runFrames, type IrisMount } from '@/iris/iris-mount';
import type { LookKey } from '@/iris/iris-scene';

/* The demo's hold on the model: it mounts the iris on the stage element, runs its frames and
   applies the whole state on every change, landing it on the next frame. A device that cannot
   run the model is reported through `failed`; the reason goes to the console. */

export type IrisControls = {
  eye: Ref<EyeName>;
  drawnAs: Ref<DrawnAs>;
  light: Ref<Light>;
  off: Ref<readonly LayerId[]>;
};

/* The shader's overlay: 2 is the structure as uncoloured clay, 1 the coordinates over the tissue. */
const OVERLAY: Record<DrawnAs, number> = { tissue: 0, structure: 2, geometry: 1 };
/* The scene luminance in log10 blondels: a dark room, an ordinary one, daylight. */
const LUMINANCE: Record<Light, number> = { night: -3, indoors: 1.7, daylight: 4 };
/* The scene eases each knob min(1, dt * 8) of the way per tick, so an eighth of a second lands
   every knob at once; that tick leaves the pupil alone. */
const SNAP_SECONDS = 1 / 8;

export function useIris(stage: Readonly<Ref<HTMLElement | null>>, controls: IrisControls) {
  const failed = ref(false);
  let mount: IrisMount | null = null;
  let observer: ResizeObserver | null = null;
  let listeners: AbortController | null = null;
  let stop = () => {};

  const applyLook = () => {
    if (!mount) return;
    const { iris } = mount;
    applyPalette(iris, controls.eye.value);
    const knobs = layerKnobs(controls.eye.value, controls.off.value);
    for (const [key, value] of Object.entries(knobs) as [LookKey, Knob][]) {
      iris.setLook(key, value);
    }
    iris.setLook('uDebug', OVERLAY[controls.drawnAs.value]);
    iris.tick(SNAP_SECONDS, false, false);
  };

  const unmount = () => {
    // Before dispose, which loses the context on purpose.
    listeners?.abort();
    listeners = null;
    stop();
    stop = () => {};
    observer?.disconnect();
    observer = null;
    mount?.dispose();
    mount = null;
  };

  const mountOn = (el: HTMLElement) => {
    try {
      mount = mountIris(el);
    } catch (err) {
      failed.value = true;
      console.error('[stroma] the shader would not load', err);
      return;
    }

    const { iris } = mount;
    iris.setReflex(true, LUMINANCE[controls.light.value]);
    iris.setHippus(true);
    applyLook();

    // A context dropped for want of memory is never restored by itself, so say so rather than
    // leaving the last frame on screen.
    listeners = new AbortController();
    const canvas = mount.renderer.gl.canvas as HTMLCanvasElement;
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        failed.value = true;
        console.error('[stroma] the graphics context was lost');
      },
      { once: true, signal: listeners.signal }
    );

    // The iris fills the shorter side of the stage and re-bakes when that changes.
    let size = 0;
    const fit = () => {
      const next = Math.floor(Math.min(el.clientWidth, el.clientHeight));
      if (next > 0 && next !== size) {
        size = next;
        mount?.resize(size);
      }
    };
    fit();
    observer = new ResizeObserver(fit);
    observer.observe(el);

    stop = runFrames((dt) => {
      // Hippus keeps the reflex from resting, so this draws every frame; a still eye would skip.
      if (iris.tick(dt, false)) return;
      iris.render();
    });
  };

  // The stage element is replaced when the layout changes, and the model moves with it.
  watch(
    stage,
    (el) => {
      unmount();
      if (el) mountOn(el);
    },
    { flush: 'post' }
  );
  watch([controls.eye, controls.drawnAs, controls.off], applyLook);
  watch(controls.light, (light) => mount?.iris.setLight(LUMINANCE[light]));
  onBeforeUnmount(unmount);

  return { failed };
}
