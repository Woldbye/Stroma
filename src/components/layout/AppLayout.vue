<script setup lang="ts">
import { computed } from 'vue';
import { useBreakpoints } from '@/composables/use-breakpoints';
import DesktopLayout from './DesktopLayout.vue';
import MobileLayout from './MobileLayout.vue';

/* The page's frame, desktop or mobile. Both take the same three slots, so the page fills them
   once and never asks which one it got. */

defineSlots<{ stage(): unknown; picker?(): unknown; controls?(): unknown }>();

const { isDesktop } = useBreakpoints();
const layout = computed(() => (isDesktop.value ? DesktopLayout : MobileLayout));
</script>

<template>
  <component :is="layout" class="demo-theme">
    <template #stage><slot name="stage" /></template>
    <template v-if="$slots.picker" #picker><slot name="picker" /></template>
    <template v-if="$slots.controls" #controls><slot name="controls" /></template>
  </component>
</template>
