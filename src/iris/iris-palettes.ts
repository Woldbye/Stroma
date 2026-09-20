/* The palette lives in the zone layer: two colours per zone, its tone and its deep colour
   where the tissue is thin over the epithelium, plus the collarette's own colour and how far
   it bleeds outward along the tissue, the limbal ring, the pigment epithelium and the
   melanin. A preset per reference photo, so the same structure can be judged against each;
   a preset also carries the few structural knobs that differ between those eyes. */

import type { IRIS_DEFAULTS } from './iris-shaders';

export type Palette = Partial<{
  [K in keyof typeof IRIS_DEFAULTS]: (typeof IRIS_DEFAULTS)[K] extends number
    ? number
    : readonly number[];
}>;

export const IRIS_PALETTES = {
  /* Blue, a pale grey-blue pupillary zone over slate, a mid blue ciliary zone over cobalt,
     the collarette the same pale tissue as the trabeculae, a dark blue-grey limbal ring, a
     fine ruff with almost no shadow, a few freckles and pale nodules. */
  'band-iris': {
    uPupillaryColor: [0.5, 0.57, 0.64],
    uPupillaryDeep: [0.28, 0.36, 0.5],
    uCiliaryColor: [0.28, 0.45, 0.62],
    uCiliaryDeep: [0.08, 0.2, 0.44],
    uCollaretteColor: [0.8, 0.85, 0.9],
    uCollaretteTint: 0,
    uCollaretteBleed: 0.1,
    uLimbalColor: [0.1, 0.14, 0.2],
    uEpitheliumColor: [0.22, 0.13, 0.09],
    uRuffShade: 0.02,
    uTissueWhiten: 0.8,
    uTrabeculaeReach: 0.45,
    uPigmentPatches: 0,
    uPatchZone: 1,
    uPigmentFreckles: 0.3,
    uNoduleLight: 0.3,
    uPigmentColor: [0.85, 0.6, 0.25],
    uFreckleColor: [0.35, 0.18, 0.08],
  },
  /* Central heterochromia, picked from the photo: an amber pupillary zone over brown-orange,
     a rusty collarette bleeding outward, a blue ciliary zone with a cyan cast over deep
     cobalt, a soft blue-grey limbus, a deep margin shadow, rust specks and amber patches
     toward the periphery. */
  multi_color: {
    uPupillaryColor: [0.82, 0.6, 0.32],
    uPupillaryDeep: [0.42, 0.24, 0.08],
    uCiliaryColor: [0.36, 0.52, 0.66],
    uCiliaryDeep: [0.08, 0.24, 0.48],
    uCollaretteColor: [0.78, 0.44, 0.14],
    uCollaretteTint: 0.85,
    uCollaretteBleed: 0.15,
    uLimbalColor: [0.18, 0.24, 0.3],
    uEpitheliumColor: [0.16, 0.09, 0.05],
    uRuffShade: 0.08,
    uTissueWhiten: 0.6,
    uTrabeculaeReach: 0.3,
    uPigmentPatches: 1,
    uPatchZone: 1,
    uPigmentFreckles: 1,
    uNoduleLight: 0,
    uPigmentColor: [0.82, 0.55, 0.22],
    uFreckleColor: [0.4, 0.18, 0.08],
  },
  /* Pale grey-white pupillary zone over a cool grey, a deep blue ciliary zone over navy, a
     thin dark limbus, almost no ruff, yellow patches toward the pupil. */
  eye_poster: {
    uPupillaryColor: [0.72, 0.74, 0.76],
    uPupillaryDeep: [0.38, 0.44, 0.52],
    uCiliaryColor: [0.22, 0.38, 0.62],
    uCiliaryDeep: [0.06, 0.16, 0.4],
    uCollaretteColor: [0.85, 0.85, 0.82],
    uCollaretteTint: 0.3,
    uCollaretteBleed: 0.08,
    uLimbalColor: [0.1, 0.16, 0.26],
    uEpitheliumColor: [0.12, 0.1, 0.12],
    uRuffShade: 0.01,
    uTissueWhiten: 0.8,
    uTrabeculaeReach: 0.45,
    uPigmentPatches: 1,
    uPatchZone: 0,
    uPigmentFreckles: 0.2,
    uNoduleLight: 0.2,
    uPigmentColor: [0.95, 0.7, 0.2],
    uFreckleColor: [0.8, 0.45, 0.1],
  },
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof IRIS_PALETTES;
