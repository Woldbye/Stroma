# Stroma

![The multi_color eye, rendered by Stroma](public/stroma.png)

A procedural model of the human iris in WebGL2, face on, with a pupil that contracts and
dilates like the organ. The structure is built one anatomical layer at a time, each its own
unit of shader code: the pupillary ruff, the collarette, the stromal fibres, the trabeculae
and the crypts of Fuchs between them, the peripheral ciliary zone, the contraction furrows
and the radial furrows, the pigment. The pupil follows the light reflex of Pamplona, Oliveira
and Baranoski, with hippus. Three palettes, each picked from a reference photograph.

Stack: Vue 3, Vite, TypeScript, [ogl](https://github.com/oframe/ogl) on WebGL2, Tailwind.

## Commands

```sh
pnpm install
pnpm dev          # the demo at http://localhost:5173, the harness at /#harness
pnpm type-check
pnpm lint         # oxlint, then eslint, both fixing
pnpm format
pnpm build
```

## How it renders

Two passes. The bake draws the iris's structure into textures at a rest pupil, in the model's
own coordinates: the angle around the pupil and the width across the iris from the pupil
margin to the root. It re-runs only when a structural knob or the size changes. The present
pass maps every screen pixel to the tissue it shows for the live pupil, so contraction is a
radial remap of the sample point, then colours it and scales the furrows with the pupil.
Moving the pupil costs one texture read per pixel; changing a colour costs nothing. Nothing in
the per-frame path allocates.

The remap is linear in the width, which is the model rather than an approximation: tracked
through dilation, a point's distance from the margin stays a constant fraction of the local
iris width, and the biomechanical correction to that is about one percent of the diameter.

## Files

- `src/iris/iris-shaders.ts` — the bake and present shaders, one function per layer, the
  knobs and which of them re-bake. Every knob is grounded in a millimetre figure.
- `src/iris/iris-scene.ts` — the two programs, the render target between them, the eased
  knobs, the settle check and the reflex.
- `src/iris/pupil-dynamics.ts` — the pupil: a delay-differential model of the light reflex in
  millimetres, with hippus as band-limited noise.
- `src/iris/iris-palettes.ts` — the presets, one per reference photograph.
- `src/iris/iris-mount.ts` — mounting the iris on an element and driving its frames.
- `src/demo/IrisDemo.vue` — the demo page. `src/dev/IrisHarness.vue` — the bench: size,
  pupil, reflex, palette, coordinate lines, timings, a pixel difference against a pinned
  render.

## License

[MIT](LICENSE).
