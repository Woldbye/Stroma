<script setup lang="ts" generic="Id extends string">
import { computed } from 'vue';
import { Switch } from '@/components/ui/switch';
import type { LayerRow } from './types';

const props = defineProps<{ rows: readonly LayerRow<Id>[] }>();
const off = defineModel<readonly Id[]>('off', { required: true });

const zones = computed(() => {
  const groups: { name: string; rows: LayerRow<Id>[] }[] = [];
  for (const row of props.rows) {
    const last = groups.at(-1);
    if (last?.name === row.zone) last.rows.push(row);
    else groups.push({ name: row.zone, rows: [row] });
  }
  return groups;
});

function setLayer(id: Id, on: boolean) {
  off.value = on ? off.value.filter((x) => x !== id) : [...off.value, id];
}
</script>

<template>
  <div>
    <div v-for="(zone, i) in zones" :key="zone.name" role="group" :aria-label="zone.name">
      <div class="flex items-center gap-2.5 pb-[7px]" :class="i === 0 ? 'pt-1.5' : 'pt-[13px]'">
        <span
          class="font-mono text-[9px] font-medium tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase"
        >
          {{ zone.name }}
        </span>
        <span class="h-px grow bg-rule" />
      </div>

      <div v-for="row in zone.rows" :key="row.id" class="flex items-center gap-3 py-[7px]">
        <span class="flex min-w-0 grow flex-col gap-[3px]" :class="!row.available && 'opacity-40'">
          <span class="flex items-center gap-2 text-[13px] leading-tight font-medium">
            {{ row.name }}
            <span
              v-if="row.tag"
              class="rounded border border-edge px-[5px] py-px font-mono text-[8.5px] font-normal tracking-[0.04em] text-subtle"
            >
              {{ row.tag }}
            </span>
          </span>
          <span class="text-[11px] leading-[1.4] text-muted-foreground">{{ row.text }}</span>
        </span>
        <Switch
          :model-value="row.available && !off.includes(row.id)"
          :disabled="!row.available"
          :aria-label="row.name"
          @update:model-value="(on: boolean) => setLayer(row.id, on)"
        />
      </div>
    </div>
  </div>
</template>
