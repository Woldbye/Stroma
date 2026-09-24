import type { EyeChip } from '@/components/controls/types';
import { IRIS_PALETTES, type Palette, type PaletteName } from '@/iris/iris-palettes';
import type { LookKey } from '@/iris/iris-scene';
import { IRIS_DEFAULTS } from '@/iris/iris-shaders';

/* The five eyes, one per palette, each shown as itself in miniature: its own colours, centre
   outward, and its ciliary colour as the glow round it on the page. */

export type EyeName = PaletteName;
export type Knob = number | readonly number[];
export type IrisEye = EyeChip<EyeName> & { glow: string };

/** A knob as an eye has it with every layer on: its palette's value, or the default. */
export function eyeKnob(eye: EyeName, key: LookKey): Knob {
  const palette: Palette = IRIS_PALETTES[eye];
  return palette[key] ?? IRIS_DEFAULTS[key];
}

function rgb(eye: EyeName, key: LookKey, alpha = 1): string {
  const [r, g, b] = (eyeKnob(eye, key) as readonly number[]).map((c) => Math.round(c * 255));
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

export const IRIS_EYES: readonly IrisEye[] = (Object.keys(IRIS_PALETTES) as EyeName[]).map(
  (name) => ({
    name,
    swatch:
      `radial-gradient(circle, ${rgb(name, 'uPupilColor')} 0 26%, ` +
      `${rgb(name, 'uCollaretteColor')} 27% 33%, ${rgb(name, 'uPupillaryColor')} 34% 45%, ` +
      `${rgb(name, 'uCiliaryColor')} 46% 82%, ${rgb(name, 'uLimbalColor')} 88% 100%)`,
    glow: rgb(name, 'uCiliaryColor', 0.14),
  })
);
