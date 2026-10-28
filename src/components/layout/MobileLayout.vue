<script setup lang="ts">
import { ChevronUp, SlidersHorizontal } from '@lucide/vue';
import { ref } from 'vue';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import SiteLinks from './SiteLinks.vue';

defineSlots<{ stage(): unknown; picker?(): unknown; controls?(): unknown }>();

const open = ref(false);
</script>

<template>
  <div class="relative flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
    <header class="flex h-[54px] shrink-0 items-center justify-between px-[18px]">
      <h1 class="font-mono text-xs font-medium tracking-[0.34em] uppercase">Stroma</h1>
      <SiteLinks />
    </header>

    <main
      class="flex min-h-0 flex-1 flex-col items-center gap-4 px-[15px]"
      :class="$slots.controls ? 'pb-[88px]' : 'pb-6'"
    >
      <div
        class="min-h-0 w-full flex-1 [&_canvas]:rounded-full [&_canvas]:shadow-[0_0_100px_18px_var(--eye-glow)]"
      >
        <slot name="stage" />
      </div>
      <div
        v-if="$slots.picker"
        class="flex shrink-0 flex-col gap-2 rounded-[14px] border border-border bg-panel/92 px-2.5 pt-2 pb-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.55)]"
      >
        <slot name="picker" />
      </div>
    </main>

    <Drawer v-if="$slots.controls" v-model:open="open" :modal="false">
      <DrawerTrigger as-child>
        <button
          type="button"
          class="absolute bottom-6 left-1/2 flex h-12 -translate-x-1/2 items-center gap-2.5 rounded-full border border-edge bg-panel/94 px-[22px] text-[13.5px] font-medium whitespace-nowrap shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
        >
          <SlidersHorizontal class="size-4" aria-hidden="true" />
          Controls
          <ChevronUp class="size-[15px] text-subtle" aria-hidden="true" />
        </button>
      </DrawerTrigger>
      <DrawerContent
        class="border-t border-border bg-panel shadow-[0_-20px_52px_rgba(0,0,0,0.72)] data-[swipe-direction=down]:max-h-[80dvh] data-[swipe-direction=down]:rounded-t-[18px]"
      >
        <DrawerTitle class="sr-only">Controls</DrawerTitle>
        <DrawerDescription class="sr-only">
          The room's light and a switch for each layer of the iris.
        </DrawerDescription>
        <div
          class="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--color-handle)_transparent] overflow-y-auto overscroll-contain pb-4"
        >
          <slot name="controls" />
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>
