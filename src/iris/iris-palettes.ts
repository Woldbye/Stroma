/* The palette lives in the zone layer: two colours per zone, its tone and its deep colour
   where the tissue is thin over the epithelium, plus the collarette's own colour and how far
   it bleeds outward along the tissue, the limbal ring, the pigment epithelium, the
   melanin, and the furrows' floor where the border layer folds. A preset per reference photo, so the same structure can be judged against each;
   a preset also carries the few structural knobs that differ between those eyes. */

import type { IRIS_DEFAULTS } from './iris-shaders';

export type Palette = Partial<{
  [K in keyof typeof IRIS_DEFAULTS]: (typeof IRIS_DEFAULTS)[K] extends number
    ? number
    : readonly number[];
}>;

export const IRIS_PALETTES = {
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
    uFurrowColor: [0.12, 0.24, 0.4],
  },
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
    uFurrowColor: [0.1, 0.2, 0.36],
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
    uFurrowColor: [0.08, 0.16, 0.34],
  },
  /* A stream iris: fine parallel fibres over the whole width, few and small openings, so the
     collagen barely deflects. Grey-green pupillary zone, blue-green ciliary zone over a
     muted teal turning yellow-green toward the root, a soft collarette, amber patches round the pupil and a few rust freckles. */
  blue_green: {
    uPupillaryColor: [0.64, 0.68, 0.52],
    uPupillaryDeep: [0.3, 0.38, 0.32],
    uCiliaryColor: [0.4, 0.6, 0.62],
    uCiliaryDeep: [0.12, 0.3, 0.36],
    uCiliaryEdgeColor: [0.56, 0.6, 0.34],
    uCiliaryEdgeTint: 0.7,
    uCollaretteColor: [0.76, 0.72, 0.5],
    uCollaretteTint: 0.35,
    uCollaretteBleed: 0.08,
    uLimbalColor: [0.12, 0.2, 0.24],
    uEpitheliumColor: [0.12, 0.09, 0.06],
    uRuffShade: 0.03,
    uTissueWhiten: 0.5,
    uBandLight: 0.2,
    uTrabeculaeReach: 0.2,
    uCryptFraction: 0.35,
    uCryptBulge: 0.4,
    uCryptColumns: 64,
    uCryptDepth: 0.6,
    uFibreContrast: 0.55,
    uFibreFade: 0.15,
    uFurrowCount: 4,
    uPigmentPatches: 0.8,
    uPatchZone: 0,
    uPigmentFreckles: 0.6,
    uNoduleLight: 0,
    uPigmentColor: [0.85, 0.62, 0.25],
    uFreckleColor: [0.55, 0.3, 0.1],
    uFurrowColor: [0.14, 0.27, 0.3],
  },
  /* Hazel with central heterochromia: a wide, noisy brown pupillary zone with a ragged
     collarette and a lobed olive amber band round it, a faint crest near the tissue's own
     colour, an olive-sage ciliary zone turning blue-grey toward the root, subtle crypts,
     brown contraction rings, and a dark slate limbal ring fading softly out into the
     sclera. */
  amber_moss: {
    uPupillaryColor: [0.46, 0.33, 0.1],
    uPupillaryDeep: [0.28, 0.17, 0.05],
    uCiliaryColor: [0.5, 0.56, 0.33],
    uCiliaryDeep: [0.22, 0.27, 0.14],
    uCiliaryEdgeColor: [0.42, 0.55, 0.53],
    uCiliaryEdgeTint: 1,
    uCollarette: 0.4,
    uCollaretteZigzag: 0.12,
    uCollaretteLight: 0.15,
    uCollaretteColor: [0.56, 0.44, 0.14],
    uCollaretteTint: 0.8,
    uCollaretteBleed: 0.3,
    uLimbalColor: [0.2, 0.28, 0.34],
    uLimbusStart: 0.8,
    uLimbusVeil: 0.05,
    uEpitheliumColor: [0.12, 0.06, 0.03],
    uRuffShade: 0.06,
    uTissueWhiten: 0.45,
    uReliefLight: 0.4,
    uFibreContrast: 0.55,
    uTrabeculaeLight: 0.15,
    uTrabeculaeReach: 0.3,
    uCryptFraction: 0.3,
    uCryptBulge: 0.5,
    uBandLight: 0,
    uFurrowCount: 5,
    uPigmentPatches: 1,
    uPatchZone: 1,
    uPigmentFreckles: 0.15,
    uNoduleLight: 0,
    uPigmentColor: [0.6, 0.48, 0.16],
    uFreckleColor: [0.25, 0.12, 0.05],
    uFurrowColor: [0.42, 0.32, 0.12],
    uFurrowRest: 0.5,
  },
  /* A flower iris: the collagen splits and converges round large rounded openings that run
     to the root, with bright bunched rims and deep teal floors. A flat amber pupillary zone,
     an amber collarette bleeding outward, a teal-green ciliary zone over dark teal, a dark
     limbus, hardly any rings, no freckles. */
  green_iris: {
    uPupillaryColor: [0.84, 0.72, 0.36],
    uPupillaryDeep: [0.46, 0.36, 0.12],
    uCiliaryColor: [0.36, 0.62, 0.55],
    uCiliaryDeep: [0.03, 0.22, 0.26],
    uCollaretteColor: [0.9, 0.76, 0.36],
    uCollaretteTint: 0.7,
    uCollaretteBleed: 0.12,
    uLimbalColor: [0.05, 0.16, 0.18],
    uEpitheliumColor: [0.1, 0.08, 0.05],
    uRuffShade: 0.03,
    uTissueWhiten: 0.45,
    uBandLight: 0.1,
    uTrabeculaeReach: 0.95,
    uCryptFraction: 1.6,
    uCryptBulge: 1.1,
    uCryptColumns: 30,
    uCryptDepth: 0.9,
    uFibreContrast: 0.7,
    uFibreFade: 0.2,
    uMesh: 1,
    uMeshWidth: 0.026,
    uMeshTaper: 0.65,
    uMeshColor: [0.78, 0.58, 0.26],
    uMeshSpread: 0.4,
    uFurrowCount: 2,
    uPigmentPatches: 0,
    uPatchZone: 0,
    uPigmentFreckles: 0,
    uNoduleLight: 0,
    uPigmentColor: [0.85, 0.65, 0.3],
    uFreckleColor: [0.4, 0.22, 0.08],
    uFurrowColor: [0.08, 0.24, 0.24],
  },
} as const satisfies Record<string, Palette>;

/** Every knob any palette sets, so switching palettes resets the ones a palette leaves out. */
export const PALETTE_KEYS = [
  ...new Set(Object.values(IRIS_PALETTES).flatMap((p) => Object.keys(p))),
] as (keyof Palette)[];

export type PaletteName = keyof typeof IRIS_PALETTES;
