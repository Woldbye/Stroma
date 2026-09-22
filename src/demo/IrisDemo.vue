<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { applyPalette, mountIris, runFrames, type IrisMount } from '@/iris/iris-mount';
import { IRIS_PALETTES, type PaletteName } from '@/iris/iris-palettes';
import { formatReport, webglReport, type ReportLine } from './webgl-report';

/* The demo: the iris alone on a dark page, as large as the viewport allows, its pupil under
   the light reflex with hippus, one eye per reference photo and the room's light under a
   slider. Nothing else: the model is the page.

   A device that cannot run the model gets the reason in place of the eye, and any device can
   ask for the same report from the header, since a phone has no console to open. */

const PALETTE_NAMES = Object.keys(IRIS_PALETTES) as PaletteName[];
const palette = ref<PaletteName>('band-iris');
/* The scene luminance in log10 blondels: -3 is a dark room, 1.7 an ordinary one, 4 daylight. */
const light = ref(1.7);

const stage = useTemplateRef<HTMLDivElement>('stage');

const failure = ref<{ headline: string; log: string } | null>(null);
const report = ref<ReportLine[]>([]);
const reportOpen = ref(false);
const copied = ref(false);
const panelOpen = computed(() => failure.value !== null || reportOpen.value);

let mount: IrisMount | null = null;
let observer: ResizeObserver | null = null;
let stop = () => {};

/* Read while the stage is still on screen: the panel hides it, and a hidden stage measures
   zero, which would report the very fault we are looking for. */
const readDevice = () => {
  report.value = webglReport(stage.value);
};

const fail = (headline: string, log: string) => {
  failure.value = { headline, log };
  readDevice();
};

onMounted(() => {
  const el = stage.value;
  if (!el) return;

  try {
    mount = mountIris(el);
  } catch (err) {
    // mountIris appends the canvas before building the scene, so a failure leaves a dead one.
    el.replaceChildren();
    fail(
      'The iris could not start on this device.',
      err instanceof Error ? err.message : String(err)
    );
    return;
  }

  const { iris } = mount;
  iris.setReflex(true, light.value);
  iris.setHippus(true);

  /* A context dropped for want of memory is never restored by itself and looks exactly like a
     shader that would not compile. Saying which it was is the whole point of the report. */
  const canvas = mount.renderer.gl.canvas as HTMLCanvasElement;
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      stop();
      fail('The graphics context was lost, most likely for want of memory.', '');
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

const toggleReport = () => {
  if (reportOpen.value) {
    reportOpen.value = false;
    return;
  }
  readDevice();
  reportOpen.value = true;
};

const copyReport = async () => {
  const text = formatReport(
    failure.value?.headline ?? 'Stroma runs here.',
    failure.value?.log ?? '',
    report.value
  );
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // A browser that refuses the clipboard still shows the report on screen.
    copied.value = false;
  }
};
</script>

<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-[#06080c] font-mono text-slate-300">
    <header class="flex items-baseline justify-between px-6 py-4">
      <h1 class="text-sm tracking-[0.3em] uppercase">Stroma</h1>
      <div class="flex items-baseline gap-5 text-xs">
        <button
          type="button"
          class="text-slate-500 hover:text-slate-300"
          :aria-pressed="reportOpen"
          @click="toggleReport"
        >
          diagnostics
        </button>
        <a href="#harness" class="text-slate-500 hover:text-slate-300">harness</a>
      </div>
    </header>

    <div
      v-show="!panelOpen"
      ref="stage"
      class="flex min-h-0 flex-1 items-center justify-center p-6"
    />

    <section
      v-if="panelOpen"
      class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-4"
    >
      <div class="w-full max-w-lg rounded-lg border border-slate-800 bg-[#0a0d13] p-5">
        <h2 class="text-sm text-slate-100">
          {{ failure?.headline ?? 'What this device says about itself' }}
        </h2>

        <p
          v-if="failure?.log"
          class="mt-3 text-xs leading-relaxed whitespace-pre-wrap text-amber-300/90"
        >
          {{ failure.log }}
        </p>

        <dl class="mt-4 space-y-1.5 border-t border-slate-800 pt-4 text-xs">
          <div v-for="line in report" :key="line.label" class="flex gap-3">
            <dt class="w-28 shrink-0 text-slate-500">{{ line.label }}</dt>
            <dd class="min-w-0 break-words text-slate-300">{{ line.value }}</dd>
          </div>
        </dl>

        <button
          type="button"
          class="mt-4 rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"
          @click="copyReport"
        >
          {{ copied ? 'copied' : 'copy report' }}
        </button>
      </div>
    </section>

    <footer
      v-show="!panelOpen"
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
