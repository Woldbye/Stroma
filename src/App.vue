<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import IrisDemo from '@/demo/IrisDemo.vue';
import IrisHarness from '@/dev/IrisHarness.vue';

/* The demo is the app; the harness, the bench the model is built on, sits at #harness. */
const hash = ref(location.hash);
const onHashChange = () => (hash.value = location.hash);
onMounted(() => addEventListener('hashchange', onHashChange));
onBeforeUnmount(() => removeEventListener('hashchange', onHashChange));

const page = computed(() => (hash.value === '#harness' ? IrisHarness : IrisDemo));
</script>

<template>
  <component :is="page" />
</template>
