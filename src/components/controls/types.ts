/* The plain data the controls take. None of it knows about the model behind it. */

export type SegmentOption<T extends string> = { value: T; label: string };

export type EyeChip<Name extends string> = { name: Name; swatch: string };

export type LayerRow<Id extends string> = {
  id: Id;
  zone: string;
  name: string;
  text: string;
  /** False when the eye has no such layer to switch. */
  available: boolean;
  /** The one eye that has this layer, when only one does. */
  tag?: string;
};
