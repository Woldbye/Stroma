<script setup lang="ts">
import SiteLinks from './SiteLinks.vue';

defineSlots<{ stage(): unknown; picker?(): unknown; controls?(): unknown }>();
</script>

<template>
  <div class="flex h-dvh w-full overflow-hidden bg-background text-foreground">
    <main class="flex min-w-0 flex-1 flex-col gap-5 px-14 py-10">
      <header class="flex items-start justify-between gap-8">
        <div class="flex flex-col gap-2">
          <h1 class="font-mono text-[13px] font-medium tracking-[0.38em] uppercase">Stroma</h1>
          <p class="max-w-[380px] text-[12.5px] leading-normal text-muted-foreground">
            A procedural model of the human iris. Strip it to its coordinates, then build it back
            one layer at a time.
          </p>
        </div>
        <SiteLinks />
      </header>

      <div class="flex min-h-0 flex-1 flex-col items-center gap-4">
        <div
          class="min-h-0 w-full flex-1 [&_canvas]:rounded-full [&_canvas]:shadow-[0_0_150px_24px_var(--eye-glow)]"
        >
          <slot name="stage" />
        </div>
        <div
          v-if="$slots.picker"
          class="flex shrink-0 flex-col gap-[9px] rounded-[14px] border border-border bg-panel/92 px-3 pt-[9px] pb-[11px] shadow-[0_14px_36px_rgba(0,0,0,0.55)]"
        >
          <slot name="picker" />
        </div>
      </div>
    </main>

    <aside
      v-if="$slots.controls"
      aria-label="Controls"
      class="flex w-[420px] shrink-0 [scrollbar-width:thin] [scrollbar-color:var(--color-handle)_transparent] flex-col overflow-y-auto border-l border-divider bg-rail"
    >
      <slot name="controls" />
    </aside>
  </div>
</template>
