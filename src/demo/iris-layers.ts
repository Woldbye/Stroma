import type { LayerRow } from '@/components/controls/types';
import type { LookKey } from '@/iris/iris-scene';
import { eyeKnob, IRIS_EYES, type EyeName, type Knob } from './iris-eyes';

/* The thirteen layers the demo switches, centre outward, each with the knob values that take it
   out of the eye; the eye's own values put it back. An eye whose own values already take a layer
   out does not have it. */

export type Knobs = Partial<Record<LookKey, Knob>>;

type IrisLayer<Id extends string = string> = {
  id: Id;
  zone: string;
  name: string;
  text: string;
  off: (eye: EyeName) => Knobs;
};

const LAYERS = [
  {
    id: 'ruff',
    zone: 'Pupillary zone',
    name: 'Pupillary ruff',
    text: 'The pigment epithelium folded forward round the margin, dark and scalloped.',
    off: () => ({ uRuffDepth: 0, uRuffShade: 0.001 }),
  },
  {
    id: 'pupillary-tone',
    zone: 'Pupillary zone',
    name: 'Pupillary zone tone',
    text: "The inner zone's own colour, from the margin out to the collarette.",
    off: (eye) => ({
      uPupillaryColor: eyeKnob(eye, 'uCiliaryColor'),
      uPupillaryDeep: eyeKnob(eye, 'uCiliaryDeep'),
    }),
  },
  {
    id: 'collarette',
    zone: 'Pupillary zone',
    name: 'Collarette',
    text: 'The thickened, ragged ring dividing the inner zone from the outer; a zigzag in most eyes.',
    off: () => ({ uCollaretteZigzag: 0, uCollaretteLight: 0, uCollaretteTint: 0 }),
  },
  {
    id: 'fibres',
    zone: 'Stroma',
    name: 'Stromal fibres',
    text: 'Radial collagen from margin to root: fine and dense inside, coarsening to cords outside.',
    off: () => ({ uFibreContrast: 0, uFibreGaps: 0 }),
  },
  {
    id: 'trabeculae',
    zone: 'Stroma',
    name: 'Trabeculae and crypts',
    text: 'Branching bundles arching over the crypts, where thin stroma lets the dark epithelium show.',
    off: () => ({ uTrabeculaeLight: 0, uCryptFraction: 0, uCryptBulge: 0 }),
  },
  {
    id: 'mesh',
    zone: 'Stroma',
    name: 'Mesh network',
    text: 'The same trabeculae read as an open-cell foam of rounded struts.',
    off: () => ({ uMesh: 0 }),
  },
  {
    id: 'band',
    zone: 'Ciliary zone',
    name: 'Peripheral ciliary band',
    text: 'The pale, cloudy band of thin stroma just inside the limbal ring.',
    off: () => ({ uBandLight: 0 }),
  },
  {
    id: 'contraction-furrows',
    zone: 'Ciliary zone',
    name: 'Contraction furrows',
    text: 'Concentric folds of the ciliary zone that deepen as the pupil dilates.',
    off: () => ({ uFurrowCount: 0 }),
  },
  {
    id: 'radial-furrows',
    zone: 'Ciliary zone',
    name: 'Radial furrows',
    text: 'Creases between the fibre bundles that open as the pupil constricts.',
    off: () => ({ uCreaseRest: 0, uCreaseOpen: 0 }),
  },
  {
    id: 'pigment',
    zone: 'Surface',
    name: 'Pigment',
    text: 'Freckles, naevi and the pale Wölfflin nodules of light irises.',
    off: () => ({ uPigmentPatches: 0, uPigmentFreckles: 0, uNoduleLight: 0 }),
  },
  {
    id: 'limbus',
    zone: 'Surface',
    name: 'Limbus',
    text: 'The dark ring at the root, where the iris passes under the corneal limbus.',
    off: () => ({ uLimbusStart: 1 }),
  },
  {
    id: 'relief',
    zone: 'Surface',
    name: 'Relief',
    text: 'The baked surface lit as a height field, so every ridge and opening takes a shadow.',
    off: () => ({ uReliefLight: 0 }),
  },
  {
    id: 'cornea-lid',
    zone: 'Surface',
    name: 'Cornea and lid',
    text: "The room reflected in the corneal dome, and the upper lid's shadow.",
    off: () => ({ uCornea: 0, uLidShadow: 0 }),
  },
] as const satisfies readonly IrisLayer[];

export type LayerId = (typeof LAYERS)[number]['id'];

export const IRIS_LAYERS: readonly IrisLayer<LayerId>[] = LAYERS;

function sameKnob(a: Knob, b: Knob): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b;
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Whether an eye has a layer at all: it does unless its own values already take the layer out. */
export function layerInEye(layer: IrisLayer, eye: EyeName): boolean {
  const off = layer.off(eye);
  return (Object.keys(off) as LookKey[]).some((key) => !sameKnob(off[key]!, eyeKnob(eye, key)));
}

/** Every knob the layers own, at the eye's value or, for a layer switched off, its off value. */
export function layerKnobs(eye: EyeName, off: readonly LayerId[]): Knobs {
  const knobs: Knobs = {};
  for (const layer of IRIS_LAYERS) {
    const offKnobs = layer.off(eye);
    const isOff = off.includes(layer.id);
    for (const key of Object.keys(offKnobs) as LookKey[]) {
      knobs[key] = isOff ? offKnobs[key] : eyeKnob(eye, key);
    }
  }
  return knobs;
}

/** The rows the layer list shows for an eye. */
export function layerRows(eye: EyeName): LayerRow<LayerId>[] {
  return IRIS_LAYERS.map((layer) => {
    const eyes = IRIS_EYES.filter((e) => layerInEye(layer, e.name));
    return {
      id: layer.id,
      zone: layer.zone,
      name: layer.name,
      text: layer.text,
      available: layerInEye(layer, eye),
      tag: eyes.length === 1 ? eyes[0].name : undefined,
    };
  });
}
