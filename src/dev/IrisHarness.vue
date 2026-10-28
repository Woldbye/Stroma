<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { applyPalette, mountIris, runFrames, type IrisMount } from '@/iris/iris-mount';
import { IRIS_DEFAULTS } from '@/iris/iris-shaders';
import { IRIS_PALETTES, type PaletteName } from '@/iris/iris-palettes';
import { createGpuTimer, measureWall, type GpuTimer } from './gpu-timer';
import { diffPixels, readPixels } from './pixel-diff';

/* The bench: the iris at a chosen pixel size with the pupil under a slider, the per-frame GPU
   time, the cost of a re-bake, and a pixel difference against a pinned earlier render. Design
   at 512, verify at 160, the size an orb would show it at. */

const SIZES = [160, 256, 512] as const;
const size = ref<(typeof SIZES)[number]>(256);
const pupil = ref<number>(IRIS_DEFAULTS.uPupil);
const debug = ref(IRIS_DEFAULTS.uDebug > 0.5);
const PALETTE_NAMES = Object.keys(IRIS_PALETTES) as PaletteName[];
const palette = ref<PaletteName>('band-iris');
/* The light reflex: the scene luminance in log10 blondels, 1.7 being an ordinary room, and
   whether the reflex owns the pupil. With it on, the pupil readout follows the reflex. */
const reflex = ref(false);
const hippus = ref(false);
const light = ref(1.7);
const dpr = window.devicePixelRatio || 1;

const irisContainer = useTemplateRef<HTMLDivElement>('irisContainer');
const diffCanvas = useTemplateRef<HTMLCanvasElement>('diffCanvas');

const timerSupported = ref(false);
const timerDebug = ref('');
/* Browsers stop animation frames for a hidden tab, so the loop, and with it the per-frame GPU
   readout, pauses while the harness sits behind another tab. Measure still works: a click
   handler renders synchronously. */
const tabHidden = ref(document.visibilityState === 'hidden');
const onVisibility = () => (tabHidden.value = document.visibilityState === 'hidden');
const gpuMs = ref<number | null>(null);
const wallMs = ref<number | null>(null);
const bakeMs = ref<number | null>(null);
const diffMean = ref<number | null>(null);
const diffMax = ref<number | null>(null);
const diffOver = ref<number | null>(null);

/* A pinned render is the diff baseline, so a step that deliberately changed the picture can
   still judge the steps after it. Kept in localStorage because every shader edit reloads the
   page. */
const PIN_KEY = 'stroma-harness-pin';
type Pin = { width: number; height: number; data: Uint8Array };
const pinned = ref<Pin | null>(null);

const loadPin = (): Pin | null => {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    const { width, height, data } = JSON.parse(raw) as {
      width: number;
      height: number;
      data: string;
    };
    return { width, height, data: Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) };
  } catch {
    return null;
  }
};

const savePin = (pin: Pin | null) => {
  try {
    if (!pin) return localStorage.removeItem(PIN_KEY);
    let binary = '';
    for (let i = 0; i < pin.data.length; i += 0x8000) {
      binary += String.fromCharCode(...pin.data.subarray(i, i + 0x8000));
    }
    localStorage.setItem(
      PIN_KEY,
      JSON.stringify({ width: pin.width, height: pin.height, data: btoa(binary) })
    );
  } catch (err) {
    console.error('[harness] pin not saved', err);
  }
};

function pinCurrent() {
  if (!mount) return;
  const gl = mount.renderer.gl as WebGL2RenderingContext;
  mount.iris.render();
  const pin = { width: gl.canvas.width, height: gl.canvas.height, data: readPixels(gl) };
  pinned.value = pin;
  savePin(pin);
}

function unpin() {
  pinned.value = null;
  savePin(null);
}

let mount: IrisMount | null = null;
let timer: GpuTimer | null = null;
let stop = () => {};

// Rolling mean of the last measurements, so the readout holds still enough to read.
const GPU_WINDOW = 60;
const gpuSamples: number[] = [];

const applySize = () => {
  mount?.resize(size.value);
  gpuSamples.length = 0;
  diffMean.value = diffMax.value = diffOver.value = null;
};

function measure() {
  if (!mount) return;
  const { iris } = mount;
  const gl = mount.renderer.gl as WebGL2RenderingContext;

  /* Best of several rounds: GPU clocks and other tabs swing single rounds by tens of percent,
     the floor is stable. */
  const ROUNDS = 5;
  const best = (render: () => void) => {
    let min = Infinity;
    for (let i = 0; i < ROUNDS; i++) min = Math.min(min, measureWall(gl, render));
    return min;
  };
  /* Snap the look to its targets first: a hidden tab gets no animation frames, so the sliders
     would otherwise never reach the render being measured. A step of a second or more lands. */
  iris.tick(1, true);

  // The steady-state frame first, then a frame that also re-bakes.
  wallMs.value = best(() => iris.render());
  bakeMs.value = best(() => {
    iris.invalidate();
    iris.render();
  });

  const { width, height } = gl.canvas;
  const pin = pinned.value;
  if (pin === null || pin.width !== width || pin.height !== height) {
    diffMean.value = diffMax.value = diffOver.value = null;
    return;
  }
  iris.render();
  const diff = diffPixels(pin.data, readPixels(gl), width, height);
  diffMean.value = diff.mean;
  diffMax.value = diff.max;
  diffOver.value = diff.over;

  const canvas = diffCanvas.value;
  if (canvas) {
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.putImageData(diff.image, 0, 0);
  }
}

onMounted(() => {
  const el = irisContainer.value;
  if (!el) return;

  mount = mountIris(el, { fadeInMs: 0 });
  const { iris } = mount;
  const gpuTimer = createGpuTimer(mount.renderer.gl as WebGL2RenderingContext);
  timer = gpuTimer;
  timerSupported.value = gpuTimer.supported;
  pinned.value = loadPin();
  applySize();

  stop = runFrames((dt) => {
    // Always draw: the harness measures the frame cost, not the settle check.
    iris.tick(dt, true);
    if (reflex.value) pupil.value = Math.round(iris.pupilRadius() * 1000) / 1000;
    gpuTimer.begin();
    iris.render();
    gpuTimer.end();
    const ms = gpuTimer.poll();
    if (ms !== null) {
      gpuSamples.push(ms);
      if (gpuSamples.length > GPU_WINDOW) gpuSamples.shift();
      gpuMs.value = gpuSamples.reduce((s, v) => s + v, 0) / gpuSamples.length;
    }
    timerDebug.value = gpuTimer.debug();
  });
  document.addEventListener('visibilitychange', onVisibility);
});

watch(size, applySize);
watch(pupil, (v) => {
  if (!reflex.value) mount?.iris.setLook('uPupil', v);
});
watch(reflex, (v) => mount?.iris.setReflex(v, light.value));
watch(light, (v) => mount?.iris.setLight(v));
watch(hippus, (v) => mount?.iris.setHippus(v));
watch(debug, (v) => mount?.iris.setLook('uDebug', v ? 1 : 0));
watch(palette, (name) => mount && applyPalette(mount.iris, name));

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  stop();
  timer?.dispose();
  mount?.dispose();
});

const fmt = (v: number | null, digits = 2) => (v === null ? '–' : v.toFixed(digits));
</script>

<template>
  <main class="min-h-dvh bg-white p-6 font-mono text-sm text-gray-800">
    <div class="mb-6 flex flex-wrap items-center gap-4">
      <label class="flex items-center gap-2">
        Size
        <select v-model="size" class="rounded border border-gray-300 px-2 py-1">
          <option v-for="s in SIZES" :key="s" :value="s">{{ s }} px</option>
        </select>
      </label>
      <label class="flex items-center gap-2">
        Pupil
        <input
          v-model.number="pupil"
          type="range"
          min="0.12"
          max="0.7"
          step="0.01"
          :disabled="reflex"
        />
        <span class="w-10">{{ pupil.toFixed(2) }}</span>
      </label>
      <label class="flex items-center gap-2">
        <input v-model="reflex" type="checkbox" />
        Reflex
      </label>
      <label class="flex items-center gap-2">
        Light
        <input v-model.number="light" type="range" min="-5" max="5" step="0.1" />
        <span class="w-12">10^{{ light.toFixed(1) }}</span>
      </label>
      <label class="flex items-center gap-2">
        <input v-model="hippus" type="checkbox" />
        Hippus
      </label>
      <label class="flex items-center gap-2">
        Palette
        <select v-model="palette" class="rounded border border-gray-300 px-2 py-1">
          <option v-for="name in PALETTE_NAMES" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2">
        <input v-model="debug" type="checkbox" />
        Coordinates
      </label>
      <button
        type="button"
        class="rounded bg-gray-900 px-3 py-1 text-white hover:bg-gray-700"
        @click="measure"
      >
        Measure
      </button>
      <button
        type="button"
        class="rounded border border-gray-400 px-3 py-1 hover:bg-gray-100"
        @click="pinCurrent"
      >
        Pin
      </button>
      <button
        v-if="pinned"
        type="button"
        class="rounded border border-gray-400 px-3 py-1 hover:bg-gray-100"
        @click="unpin"
      >
        Unpin
      </button>
      <span class="text-gray-500">DPR {{ dpr }} · {{ size * dpr }} px canvas</span>
    </div>

    <div class="flex flex-wrap gap-8">
      <section>
        <h2 class="mb-2 font-semibold">Iris</h2>
        <div ref="irisContainer" :style="{ width: `${size}px`, height: `${size}px` }" />
        <p class="mt-2">wall {{ fmt(wallMs) }} ms</p>
        <p>bake+frame {{ fmt(bakeMs) }} ms</p>
        <p>
          gpu {{ fmt(gpuMs) }} ms
          <span v-if="!timerSupported" class="text-gray-500">(timer query unavailable)</span>
          <span v-else-if="tabHidden" class="text-gray-500">(loop paused: tab hidden)</span>
        </p>
        <p class="text-gray-500" data-timer-debug>{{ timerDebug }}</p>
      </section>
      <section>
        <h2 class="mb-2 font-semibold">
          Difference ×8
          <span class="font-normal text-gray-500">
            {{ pinned ? `vs pinned ${pinned.width} px` : 'no pin' }}
          </span>
        </h2>
        <canvas ref="diffCanvas" :style="{ width: `${size}px`, height: `${size}px` }" />
        <p class="mt-2">mean {{ fmt(diffMean) }} / 255</p>
        <p>max {{ fmt(diffMax, 0) }} / 255</p>
        <p>over 8: {{ diffOver === null ? '–' : (diffOver * 100).toFixed(2) + '%' }}</p>
      </section>
    </div>
  </main>
</template>
