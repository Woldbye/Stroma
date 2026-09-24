<script setup lang="ts" generic="T extends string">
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { SegmentOption } from './types';

defineProps<{ options: readonly SegmentOption<T>[]; label: string }>();
const model = defineModel<T>({ required: true });

// A single-choice group lets its chosen item be clicked off; a segmented control always has one.
function choose(value: unknown) {
  if (typeof value === 'string' && value) model.value = value as T;
}
</script>

<template>
  <ToggleGroup
    type="single"
    :model-value="model"
    :aria-label="label"
    :spacing="1"
    class="grid w-full auto-cols-fr grid-flow-col gap-[3px] rounded-lg border border-border bg-well p-[3px]"
    @update:model-value="choose"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="h-8 w-full rounded-md px-2 text-[11.5px] font-medium text-subtle hover:bg-transparent hover:text-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground lg:h-7"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
