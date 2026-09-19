# Stroma

A procedural WebGL model of the human iris, face on, with a live pupil. Built one anatomical
layer at a time: pupil and ruff, pupillary zone, collarette, ciliary zone with its trabeculae,
crypts and contraction furrows, the limbus. The names are in [docs/anatomy.md](docs/anatomy.md)
and the plan in [docs/plans](docs/plans).

Stack: Vue 3, Vite, TypeScript, [ogl](https://github.com/oframe/ogl) on WebGL2, Tailwind for
the harness page.

## Commands

```sh
pnpm install
pnpm dev          # the harness at http://localhost:5173
pnpm type-check
pnpm lint         # oxlint, then eslint, both fixing
pnpm format
pnpm build
```

## How it renders

Two passes. The bake draws the iris's structure into a square texture at a rest pupil, in
the model's own coordinates: the angle around the pupil and the width across the iris from
the pupil margin to the root. It re-runs only when a structural knob or the size changes. The
present pass maps every screen pixel to the tissue it shows for the live pupil, so contraction
is a radial remap of the sample point, then colours it. Moving the pupil costs one texture
read per pixel; changing a colour costs nothing.

## Files

- `src/iris/iris-shaders.ts` — the bake and present shaders, the knobs and which of them
  re-bake.
- `src/iris/iris-scene.ts` — the two programs, the render target between them, the eased
  knobs and the settle check. Nothing in its per-frame path allocates.
- `src/dev/IrisHarness.vue` — the bench: size, pupil slider, coordinate lines, timings, a
  pixel difference against a pinned render. `gpu-timer.ts` and `pixel-diff.ts` support it.
- `docs/anatomy.md` — the vocabulary. `docs/plans/` — the layer plan and its measurements.
