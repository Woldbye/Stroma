<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import ControlSection from '@/components/controls/ControlSection.vue';
import EyePicker from '@/components/controls/EyePicker.vue';
import LayerList from '@/components/controls/LayerList.vue';
import SegmentedControl from '@/components/controls/SegmentedControl.vue';
import AppLayout from '@/components/layout/AppLayout.vue';
import { useIris } from '@/composables/use-iris';
import { DRAWN_AS_OPTIONS, LIGHT_OPTIONS, type DrawnAs, type Light } from './demo-state';
import { IRIS_EYES, type EyeName } from './iris-eyes';
import { layerRows, type LayerId } from './iris-layers';

/* The demo: the iris on a dark page with its five eyes beneath it, and the controls that strip
   it to its coordinates and build it back: how it is drawn, the room's light, and a switch for
   each anatomical layer. */

const eye = ref<EyeName>('green_iris');
const drawnAs = ref<DrawnAs>('tissue');
const light = ref<Light>('indoors');
const off = ref<readonly LayerId[]>([]);

const stage = useTemplateRef<HTMLDivElement>('stage');
const { failed } = useIris(stage, { eye, drawnAs, light, off });

const rows = computed(() => layerRows(eye.value));
const glow = computed(() => IRIS_EYES.find((e) => e.name === eye.value)?.glow);
</script>

<template>
  <AppLayout>
    <template #stage>
      <p
        v-if="failed"
        class="flex size-full items-center justify-center px-6 text-center text-xs text-muted-foreground"
      >
        Failed to load the iris shader on this device.
      </p>
      <div
        v-else
        ref="stage"
        class="flex size-full items-center justify-center"
        :style="{ '--eye-glow': glow }"
      />
    </template>

    <template v-if="!failed" #picker>
      <EyePicker v-model="eye" :eyes="IRIS_EYES" :muted="drawnAs === 'structure'" />
      <SegmentedControl v-model="drawnAs" :options="DRAWN_AS_OPTIONS" label="Drawn as" />
    </template>

    <template v-if="!failed" #controls>
      <ControlSection title="Light" class="border-b border-divider pt-5 pb-4">
        <SegmentedControl v-model="light" :options="LIGHT_OPTIONS" label="Light" />
      </ControlSection>
      <ControlSection title="Layers" class="pt-4 pb-6">
        <LayerList v-model:off="off" :rows="rows" />
      </ControlSection>
    </template>
  </AppLayout>
</template>
