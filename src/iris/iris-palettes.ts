/* The palette lives in the zone layer: one colour per zone, plus the collarette's own colour
   and how far it bleeds outward along the tissue, the limbal ring and the pigment epithelium.
   A preset per reference photo, so the same structure can be judged against each; a preset
   may also carry the few structural knobs that differ between those eyes. */

import type { IRIS_DEFAULTS } from './iris-shaders';

export type Palette = Partial<{
  [K in keyof typeof IRIS_DEFAULTS]: (typeof IRIS_DEFAULTS)[K] extends number
    ? number
    : readonly number[];
}>;

export const IRIS_PALETTES = {
  /* Blue, a pale grey-blue pupillary zone, a mid blue ciliary zone, the collarette the same
     pale tissue as the trabeculae, a dark blue-grey limbal ring, a fine ruff with almost no
     shadow. */
  'band-iris': {
    uPupillaryColor: [0.5, 0.57, 0.64],
    uCiliaryColor: [0.28, 0.45, 0.62],
    uCollaretteColor: [0.8, 0.85, 0.9],
    uCollaretteTint: 0,
    uCollaretteBleed: 0.1,
    uLimbalColor: [0.1, 0.14, 0.2],
    uEpitheliumColor: [0.22, 0.13, 0.09],
    uRuffShade: 0.02,
    uTissueWhiten: 0.8,
  },
  /* Central heterochromia: an amber pupillary zone, a rusty collarette bleeding outward, a
     blue-grey ciliary zone, a soft grey limbus, and a deep margin shadow. */
  multi_color: {
    uPupillaryColor: [0.78, 0.58, 0.32],
    uCiliaryColor: [0.5, 0.58, 0.64],
    uCollaretteColor: [0.72, 0.4, 0.14],
    uCollaretteTint: 0.85,
    uCollaretteBleed: 0.15,
    uLimbalColor: [0.28, 0.3, 0.32],
    uEpitheliumColor: [0.16, 0.09, 0.05],
    uRuffShade: 0.08,
    uTissueWhiten: 0.5,
    uTrabeculaeReach: 0.3,
  },
  /* Pale grey-white pupillary zone, a deep blue ciliary zone, a thin dark limbus, almost no
     ruff. */
  eye_poster: {
    uPupillaryColor: [0.72, 0.74, 0.76],
    uCiliaryColor: [0.22, 0.38, 0.62],
    uCollaretteColor: [0.85, 0.85, 0.82],
    uCollaretteTint: 0.3,
    uCollaretteBleed: 0.08,
    uLimbalColor: [0.1, 0.16, 0.26],
    uEpitheliumColor: [0.12, 0.1, 0.12],
    uRuffShade: 0.01,
    uTissueWhiten: 0.8,
  },
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof IRIS_PALETTES;
