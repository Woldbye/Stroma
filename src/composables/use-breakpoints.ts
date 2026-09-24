import { breakpointsTailwind, useMediaQuery } from '@vueuse/core';

/* Tailwind's own breakpoints as reactive flags, asked the way Tailwind asks them: `lg:` is
   `(width >= 64rem)`, so a layout chosen here and an `lg:` class agree at any browser font
   size. vueuse keeps the same breakpoints in pixels, at 16 to the rem. Media queries, so they
   change only when a breakpoint is crossed. */

export type Breakpoint = keyof typeof breakpointsTailwind;

const PX_PER_REM = 16;

export function useBreakpoints() {
  const isAtLeast = (name: Breakpoint) =>
    useMediaQuery(`(width >= ${breakpointsTailwind[name] / PX_PER_REM}rem)`);
  return {
    isDesktop: isAtLeast('lg'),
    isAtLeast,
    breakpoints: breakpointsTailwind,
  };
}
