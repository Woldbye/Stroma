import type { SegmentOption } from '@/components/controls/types';

/* The demo's two three-way choices as the controls show them. What each means to the model is
   decided in src/composables/use-iris.ts. */

export type DrawnAs = 'tissue' | 'structure' | 'geometry';
export type Light = 'night' | 'indoors' | 'daylight';

export const DRAWN_AS_OPTIONS: readonly SegmentOption<DrawnAs>[] = [
  { value: 'tissue', label: 'Tissue' },
  { value: 'structure', label: 'Structure' },
  { value: 'geometry', label: 'Geometry' },
];

export const LIGHT_OPTIONS: readonly SegmentOption<Light>[] = [
  { value: 'night', label: 'Night' },
  { value: 'indoors', label: 'Indoors' },
  { value: 'daylight', label: 'Daylight' },
];
