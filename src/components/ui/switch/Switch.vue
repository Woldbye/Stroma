<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<SwitchRootProps & { class?: HTMLAttributes['class'] }>();

const emits = defineEmits<SwitchRootEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <SwitchRoot
    v-slot="slotProps"
    data-slot="switch"
    v-bind="forwarded"
    :class="
      cn(
        'peer inline-flex h-[19px] w-[34px] shrink-0 items-center rounded-full border p-px transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:bg-primary data-[state=unchecked]:border-edge data-[state=unchecked]:bg-input',
        props.class
      )
    "
  >
    <SwitchThumb
      data-slot="switch-thumb"
      class="pointer-events-none block rounded-full ring-0 transition-transform data-[state=checked]:size-[15px] data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-primary-foreground data-[state=unchecked]:size-[13px] data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-thumb-off"
    >
      <slot name="thumb" v-bind="slotProps" />
    </SwitchThumb>
  </SwitchRoot>
</template>
