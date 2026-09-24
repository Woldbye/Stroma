<script setup lang="ts">
import { ExternalLink } from '@lucide/vue';
</script>

<template>
  <nav
    class="flex items-center gap-4 font-mono text-[10px] tracking-[0.1em] uppercase lg:gap-[18px]"
  >
    <a href="#harness" class="py-3 text-subtle transition-colors hover:text-foreground">Harness</a>
    <a
      href="https://github.com/Woldbye/Stroma"
      target="_blank"
      rel="noopener"
      class="flex items-center gap-1.5 py-3 text-subtle transition-colors hover:text-foreground"
    >
      GitHub
      <ExternalLink class="size-[11px]" aria-hidden="true" />
    </a>
  </nav>
</template>
