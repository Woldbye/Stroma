<script setup lang="ts" generic="Name extends string">
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { EyeChip } from './types';

defineProps<{ eyes: readonly EyeChip<Name>[]; muted?: boolean }>();
const model = defineModel<Name>({ required: true });

// A single-choice group lets its chosen item be clicked off; there is always an eye.
function choose(value: unknown) {
  if (typeof value === 'string' && value) model.value = value as Name;
}
</script>

<template>
  <ToggleGroup
    type="single"
    :model-value="model"
    aria-label="Eye"
    :spacing="1"
    class="gap-px transition-opacity lg:gap-0.5"
    :class="muted && 'opacity-35'"
    @update:model-value="choose"
  >
    <ToggleGroupItem
      v-for="eye in eyes"
      :key="eye.name"
      :value="eye.name"
      class="group h-auto w-[62px] flex-col gap-1.5 rounded-[9px] px-0 py-1.5 hover:bg-transparent data-[state=on]:bg-chip lg:w-[66px] lg:gap-[7px]"
    >
      <span
        class="size-[30px] rounded-full bg-(image:--swatch) shadow-[0_0_0_2px_var(--color-panel),0_0_0_3px_var(--color-ring-idle)] group-data-[state=on]:shadow-[0_0_0_2px_var(--color-chip),0_0_0_3.5px_var(--color-foreground)]"
        :style="{ '--swatch': eye.swatch }"
      />
      <span
        class="font-mono text-[8px] font-normal whitespace-nowrap text-muted-foreground group-data-[state=on]:text-foreground lg:text-[9px]"
      >
        {{ eye.name }}
      </span>
    </ToggleGroupItem>
  </ToggleGroup>
</template>
