<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { Renderer } from 'ogl';
import { createIrisScene, type IrisScene, type LookKey } from '@/iris/iris-scene';
import { IRIS_PALETTES, type PaletteName } from '@/iris/iris-palettes';

/* The demo: the iris alone on a dark page, as large as the viewport allows, its pupil under
   the light reflex with hippus, one eye per reference photo and the room's light under a
   slider. Nothing else: the model is the page. */

const PALETTE_NAMES = Object.keys(IRIS_PALETTES) as PaletteName[];
const palette = ref<PaletteName>('band-iris');
/* The scene luminance in log10 blondels: -3 is a dark room, 1.7 an ordinary one, 4 daylight. */
const light = ref(1.7);

const stage = useTemplateRef<HTMLDivElement>('stage');

let renderer: Renderer | null = null;
let iris: IrisScene | null = null;
let observer: ResizeObserver | null = null;
let rafId = 0;

const applyPalette = (name: PaletteName) => {
  for (const [key, value] of Object.entries(IRIS_PALETTES[name])) {
    iris?.setLook(key as LookKey, value);
  }
};

onMounted(() => {
  const el = stage.value;
  if (!el) return;

  renderer = new Renderer({
    webgl: 2,
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    dpr: window.devicePixelRatio || 1,
  });
  el.appendChild(renderer.gl.canvas);

  iris = createIrisScene(renderer);
  iris.setLook('uDebug', 0);
  iris.setReflex(true, light.value);
  iris.setHippus(true);
  // The scene on the window, so a script can drive frames while the tab is hidden.
  (window as unknown as { stroma?: { iris: IrisScene; renderer: Renderer } }).stroma = {
    iris,
    renderer,
  };

  // The iris fills the shorter side of the stage and re-bakes when that changes.
  const fit = () => {
    const size = Math.floor(Math.min(el.clientWidth, el.clientHeight));
    if (size <= 0 || !renderer || !iris) return;
    renderer.setSize(size, size);
    iris.resized();
  };
  fit();
  observer = new ResizeObserver(fit);
  observer.observe(el);

  let last = 0;
  const loop = (t: number) => {
    rafId = requestAnimationFrame(loop);
    const dt = last === 0 ? 0 : Math.min((t - last) * 0.001, 0.05);
    last = t;
    if (!iris) return;
    // Hippus keeps the reflex from resting, so this draws every frame; a still eye would skip.
    if (iris.tick(dt, false)) return;
    iris.render();
  };
  rafId = requestAnimationFrame(loop);
});

watch(palette, applyPalette);
watch(light, (v) => iris?.setLight(v));

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  observer?.disconnect();
  renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext();
});
</script>

<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-[#06080c] font-mono text-slate-300">
    <header class="flex items-baseline justify-between px-6 py-4">
      <h1 class="text-sm tracking-[0.3em] uppercase">Stroma</h1>
      <a href="#harness" class="text-xs text-slate-500 hover:text-slate-300">harness</a>
    </header>

    <div ref="stage" class="flex min-h-0 flex-1 items-center justify-center p-6" />

    <footer class="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-5 text-xs">
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
