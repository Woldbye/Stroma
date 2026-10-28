<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <section class="flex flex-col gap-[11px] px-5">
    <h2 class="font-mono text-[10px] font-medium tracking-[0.18em] text-label uppercase">
      {{ title }}
    </h2>
    <slot />
  </section>
</template>
