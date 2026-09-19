/* The iris surface, face on: a procedural model of the human iris in its own anatomical
   coordinates. The angle around the pupil and the width across the iris, 0 at the pupil
   margin and 1 at the root, are the axes every structure is defined in; docs/anatomy.md has
   the names. GLSL ES 3.00 (WebGL2 only).

   Two passes. The bake draws the structure into a square texture at the rest pupil whenever
   a structural knob or the size changes. The present pass maps each screen pixel to the
   tissue it shows for the live pupil, so contraction is a radial remap of the sample point,
   then colours it: the pupil can move every frame for the cost of one texture read. */

export const IRIS_VERT = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* Shared by both passes: the coordinate model. */
const COORDINATES = `
#define PI 3.14159265
#define saturate(i) clamp(i, 0.0, 1.0)

/* The pupil radius the structure is baked at, as a fraction of the iris radius. The present
   pass stretches or compresses the tissue between this and the live pupil. */
#define REST_PUPIL 0.25

/* Centred, aspect-corrected coordinates with unit radius in the shorter axis: the root sits
   on the unit circle. The bake target is square, so there the disc is inscribed in the
   texture. */
vec2 discPoint(vec2 uv) {
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= uResolution.x / uResolution.y;
    return p;
}

/* The angle around the pupil as a turn in 0..1. The wrap sits at the left, where an eyelid
   would hide a seam. */
float turnOf(vec2 p) {
    return fract(atan(p.y, p.x) / (2.0 * PI) + 0.5);
}

/* The width across the iris at a radius, for a pupil: 0 at the pupil margin, 1 at the root,
   negative inside the pupil. */
float widthOf(float r, float pupil) {
    return (r - pupil) / (1.0 - pupil);
}
`;

export const IRIS_BAKE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

/* ---- host contract ---- */
uniform vec2 uResolution;

/* ---- structure ---- */
uniform float uCollarette;
${COORDINATES}
/* Step 0 of the model: the coordinates themselves, so the present pass's remap can be seen.
   Red is the width, green the turn, blue 1 in the pupillary zone and 0 in the ciliary zone,
   with a hair of softness at the collarette. */
void main() {
    vec2 p = discPoint(vUv);
    float r = length(p);
    float w = widthOf(r, REST_PUPIL);
    float pupillary = 1.0 - smoothstep(uCollarette - 0.004, uCollarette + 0.004, w);
    outColor = vec4(saturate(w), turnOf(p), pupillary, 1.0);
}
`;

export const IRIS_PRESENT_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

/* ---- host contract ---- */
uniform float uAlpha;
uniform vec2 uResolution;
uniform sampler2D uIris;

/* ---- state ---- */
uniform float uPupil;
uniform float uCollarette;
uniform vec3 uPupilColor;
uniform float uDebug;
${COORDINATES}
/* One-pixel anti-aliased edge at the root; fwidth makes it resolution independent. */
float discMask(float r) {
    float edge = fwidth(r);
    return 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
}

/* A line wherever x crosses a whole number, about a pixel wide at any size. */
float isoline(float x) {
    float f = fract(x);
    return 1.0 - smoothstep(0.0, fwidth(x) * 1.5, min(f, 1.0 - f));
}

/* Step 0: flat zone tones, the pupillary zone the darker. */
vec3 zoneTones(vec4 structure) {
    return mix(vec3(0.62), vec3(0.48), structure.b);
}

/* The coordinate check: a line every tenth of the width and every fifteen degrees from the
   live coordinates, and the collarette in gold from the width read back out of the bake, so
   the gold ring and the zone tone show the remap while the grid shows what it should be. */
vec3 debugLayer(vec3 col, vec4 structure, float w, float t) {
    float lines = max(isoline(w * 10.0), isoline(t * 24.0));
    col = mix(col, vec3(0.15), lines * 0.6);
    float collarette =
        1.0 - smoothstep(0.0, fwidth(structure.r) * 2.0, abs(structure.r - uCollarette));
    return mix(col, vec3(1.0, 0.8, 0.3), collarette);
}

void main() {
    vec2 p = discPoint(vUv);
    float r = length(p);
    float disc = discMask(r);
    float w = widthOf(r, uPupil);

    // Contraction: this pixel shows the tissue that sat at rRest when the structure was baked.
    float rRest = REST_PUPIL + w * (1.0 - REST_PUPIL);
    vec2 q = p * (rRest / max(r, 1e-5));
    vec4 structure = texture(uIris, q * 0.5 + 0.5);

    vec3 col = zoneTones(structure);
    col = mix(col, debugLayer(col, structure, w, turnOf(p)), uDebug);
    // The pupil margin, a soft edge for now; the ruff comes with its own step.
    float pupil = 1.0 - smoothstep(-0.004, 0.004, w);
    col = mix(col, uPupilColor, pupil);

    float a = disc * uAlpha;
    // Premultiplied alpha: the canvas is composited that way.
    outColor = vec4(col * a, a);
}
`;

/** Every knob the shaders expose; the host copies these into uniforms at build time. */
export const IRIS_DEFAULTS = {
  uPupil: 0.25, // live pupil radius, a fraction of the iris radius; the bake sits at REST_PUPIL
  uCollarette: 0.3, // the collarette's position across the width, 0 at the margin, 1 at the root
  uPupilColor: [0, 0, 0],
  uDebug: 1, // the coordinate lines; 0 hides them
} as const;

/** Knobs the bake reads; a change to any of them re-bakes. The rest are present-only. */
export const IRIS_BAKE_KEYS = [
  'uCollarette',
] as const satisfies readonly (keyof typeof IRIS_DEFAULTS)[];
