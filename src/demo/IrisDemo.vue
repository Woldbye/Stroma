<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { applyPalette, mountIris, runFrames, type IrisMount } from '@/iris/iris-mount';
import { IRIS_PALETTES, type PaletteName } from '@/iris/iris-palettes';

/* The demo: the iris alone on a dark page, as large as the viewport allows, its pupil under
   the light reflex with hippus, one eye per reference photo and the room's light under a
   slider. Nothing else: the model is the page.

   A device that cannot run the model says so in place of the eye rather than drawing nothing;
   the reason goes to the console, where a developer can reach it. */

const PALETTE_NAMES = Object.keys(IRIS_PALETTES) as PaletteName[];
const palette = ref<PaletteName>('band-iris');
/* The scene luminance in log10 blondels: -3 is a dark room, 1.7 an ordinary one, 4 daylight. */
const light = ref(1.7);

const stage = useTemplateRef<HTMLDivElement>('stage');
const failed = ref(false);

let mount: IrisMount | null = null;
let observer: ResizeObserver | null = null;
let stop = () => {};

onMounted(() => {
  const el = stage.value;
  if (!el) return;

  try {
    mount = mountIris(el);
  } catch (err) {
    // mountIris appends the canvas before building the scene, so a failure leaves a dead one.
    el.replaceChildren();
    failed.value = true;
    console.error('[stroma] the shader would not load', err);
    return;
  }

  const { iris } = mount;
  iris.setReflex(true, light.value);
  iris.setHippus(true);

  // A context dropped for want of memory is never restored by itself, so say so rather than
  // leaving the last frame on screen.
  const canvas = mount.renderer.gl.canvas as HTMLCanvasElement;
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      stop();
      failed.value = true;
      console.error('[stroma] the graphics context was lost');
    },
    { once: true }
  );

  // The iris fills the shorter side of the stage and re-bakes when that changes.
  const fit = () => {
    const size = Math.floor(Math.min(el.clientWidth, el.clientHeight));
    if (size > 0) mount?.resize(size);
  };
  fit();
  observer = new ResizeObserver(fit);
  observer.observe(el);

  stop = runFrames((dt) => {
    // Hippus keeps the reflex from resting, so this draws every frame; a still eye would skip.
    if (iris.tick(dt, false)) return;
    iris.render();
  });
});

watch(palette, (name) => mount && applyPalette(mount.iris, name));
watch(light, (v) => mount?.iris.setLight(v));

onBeforeUnmount(() => {
  stop();
  observer?.disconnect();
  mount?.dispose();
});
</script>

<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-[#06080c] font-mono text-slate-300">
    <header class="flex items-baseline justify-between px-6 py-4">
      <h1 class="text-sm tracking-[0.3em] uppercase">Stroma</h1>
      <a href="#harness" class="text-xs text-slate-500 hover:text-slate-300">harness</a>
    </header>

    <div v-show="!failed" ref="stage" class="flex min-h-0 flex-1 items-center justify-center p-6" />

    <p
      v-if="failed"
      class="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-xs text-slate-500"
    >
      Failed to load the iris shader on this device.
    </p>

    <footer
      v-show="!failed"
      class="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-5 text-xs"
    >
      <div class="flex gap-2" role="group" aria-label="Eye">
        <button
          v-for="name in PALETTE_NAMES"
          :key="name"
          type="button"
          class="rounded-full border px-3 py-1 transition-colors"
          :class="
            name === palette
              ? 'border-slate-300 text-slate-100'
              : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
          "
          :aria-pressed="name === palette"
          @click="palette = name"
        >
          {{ name.replace('_', ' ') }}
        </button>
      </div>
      <label class="flex items-center gap-3">
        <span class="text-slate-500">dark</span>
        <input
          v-model.number="light"
          type="range"
          min="-3"
          max="4"
          step="0.1"
          class="w-48 accent-slate-400"
          aria-label="Light"
        />
        <span class="text-slate-500">bright</span>
      </label>
    </footer>
  </main>
</template>
