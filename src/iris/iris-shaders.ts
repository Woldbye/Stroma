/* The iris surface, face on: a procedural model of the human iris in its own anatomical
   coordinates. The angle around the pupil and the width across the iris, 0 at the pupil
   margin and 1 at the root, are the axes every structure is defined in; docs/anatomy.md has
   the names and the measurements. GLSL ES 3.00 (WebGL2 only).

   Two passes. The bake draws the structure into a square texture at the rest pupil whenever
   a structural knob or the size changes. The present pass maps each screen pixel to the
   tissue it shows for the live pupil, so contraction is a radial remap of the sample point,
   then colours it: the pupil can move every frame for the cost of one texture read.

   The bake's four fields, one per channel. Every layer is one of two substances, the pale
   tissue of the anterior border layer and the dark pigment epithelium showing through where
   it thins, so no layer paints colour: red is tissue lightness, 0.5 the zone's own tone;
   green is opening depth, how much epithelium shows; blue is zone membership, 1 pupillary
   and 0 ciliary; alpha is pigment. */

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

/* The pupil radius the structure is baked at, as a fraction of the iris radius: a 3.6 mm
   pupil in a 12 mm iris, indoors. The present pass stretches or compresses the tissue between
   this and the live pupil. */
#define REST_PUPIL 0.3

/* ---- pupil margin, both passes ---- */
uniform vec2 uPupilCentre;
uniform float uPupilWobble;

/* Centred, aspect-corrected coordinates with unit radius in the shorter axis: the root sits
   on the unit circle. The bake target is square, so there the disc is inscribed in the
   texture. */
vec2 discPoint(vec2 uv) {
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= uResolution.x / uResolution.y;
    return p;
}

/* The pupil margin's departure from a circle, as a factor on its radius: a few low harmonics
   of the turn, seam-safe because every term is whole turns. */
float marginWobble(float t) {
    float a = 2.0 * PI * t;
    return 1.0 + uPupilWobble * (0.6 * sin(2.0 * a + 0.7) + 0.3 * sin(3.0 * a + 2.9)
                               + 0.2 * sin(5.0 * a + 1.3) + 0.1 * sin(7.0 * a + 4.1));
}

/* The ray from the pupil centre through a point. The pupil sits nasal and superior of the
   iris centre, so the width is measured along these rays from the margin to where the ray
   meets the root, Daugman's non-concentric form. The turn is the angle around the pupil in
   0..1, its wrap at the left where an eyelid would hide a seam. */
struct Ray {
    float t;
    vec2 dir;
    float dist;
    float root;
};

Ray rayOf(vec2 p) {
    vec2 q = p - uPupilCentre;
    Ray ray;
    ray.dist = length(q);
    ray.dir = q / max(ray.dist, 1e-5);
    ray.t = fract(atan(ray.dir.y, ray.dir.x) / (2.0 * PI) + 0.5);
    float b = dot(uPupilCentre, ray.dir);
    ray.root = -b + sqrt(b * b + 1.0 - dot(uPupilCentre, uPupilCentre));
    return ray;
}

/* The width across the iris along a ray, for a pupil: 0 at the pupil margin, 1 at the root,
   negative inside the pupil. */
float widthOf(Ray ray, float pupil) {
    float margin = pupil * marginWobble(ray.t);
    return (ray.dist - margin) / (ray.root - margin);
}

/* Where the tissue at a width along a ray sat when the structure was baked: the present
   pass's remap into the bake. */
vec2 restPoint(Ray ray, float w) {
    float margin = REST_PUPIL * marginWobble(ray.t);
    return uPupilCentre + ray.dir * (margin + w * (ray.root - margin));
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
uniform float uRuffDepth;
uniform float uRuffCrenation;
uniform float uRuffShade;
${COORDINATES}
/* ======================= primitives ======================= */

float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

/* Value noise around the circle: t is the turn in 0..1, periodic by wrapping the cell index,
   so no seam blend is needed. Cells must be whole. */
float turnNoise(float t, float cells, float seed) {
    float x = t * cells;
    float ix = floor(x);
    float fx = x - ix;
    fx = fx * fx * (3.0 - 2.0 * fx);
    float a = hash21(vec2(mod(ix, cells), seed));
    float b = hash21(vec2(mod(ix + 1.0, cells), seed));
    return mix(a, b, fx);
}

/* ======================= layers ======================= */

/* The pupillary ruff: the posterior pigment epithelium folded forward round the margin, an
   opening onto the epithelium in two parts. The frill is a rim about 0.1 mm deep whose outer
   edge is crenated where the epithelium's radial folds meet the margin, feathered by half its
   own depth so it reads as folded tissue rather than a ring. The margin shadow is the
   epithelium's darkness bleeding outward through the thin stroma just behind the margin,
   decaying over a few tenths of a millimetre. */
#define RUFF_CRENATIONS 120.0
#define RUFF_CRENATION_GROUPS 40.0

float pupillaryRuff(float w, float t) {
    float crenation = turnNoise(t, RUFF_CRENATIONS, 3.0) * 0.65
                    + turnNoise(t, RUFF_CRENATION_GROUPS, 5.0) * 0.35;
    float edge = uRuffDepth * (1.0 + uRuffCrenation * (crenation * 2.0 - 1.0));
    float frill = 1.0 - smoothstep(edge * 0.5, edge * 1.5, w);
    float shadow = exp(-max(w, 0.0) / uRuffShade);
    return max(frill, shadow);
}

/* The zones: pupillary inside the collarette, ciliary outside, with a hair of softness at the
   boundary. The collarette's own path comes with its step. */
float zoneOf(float w) {
    return 1.0 - smoothstep(uCollarette - 0.004, uCollarette + 0.004, w);
}

/* ======================= composition ======================= */

void main() {
    vec2 p = discPoint(vUv);
    Ray ray = rayOf(p);
    float w = widthOf(ray, REST_PUPIL);

    float tissue = 0.5;
    float opening = pupillaryRuff(w, ray.t);
    float zone = zoneOf(w);
    float pigment = 0.0;
    outColor = vec4(tissue, opening, zone, pigment);
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
uniform vec3 uPupilColor;
uniform float uDebug;

/* ---- palette ---- */
uniform vec3 uEpitheliumColor;
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

/* ======================= layers ======================= */

/* Flat zone tones for now, the pupillary zone the darker; the palette comes with its step. */
vec3 zoneTones(vec4 structure) {
    return mix(vec3(0.62), vec3(0.48), structure.b);
}

/* Openings onto the pigment epithelium: the ruff now, the crypts and furrows later. */
vec3 openingLayer(vec3 col, vec4 structure) {
    return mix(col, uEpitheliumColor, structure.g);
}

/* The pupil: the opening inside the margin, one pixel soft at any size. */
float pupilMask(float w) {
    float edge = fwidth(w);
    return 1.0 - smoothstep(-edge, edge, w);
}

/* The coordinate check: a line every tenth of the width and every fifteen degrees from the
   live coordinates, and the zone boundary in gold from the bake, so the gold ring and the
   zone tone show the remap while the grid shows what it should be. */
vec3 debugLayer(vec3 col, vec4 structure, float w, float t) {
    float lines = max(isoline(w * 10.0), isoline(t * 24.0));
    col = mix(col, vec3(0.15), lines * 0.6);
    float boundary =
        1.0 - smoothstep(0.0, fwidth(structure.b) * 2.0, abs(structure.b - 0.5));
    return mix(col, vec3(1.0, 0.8, 0.3), boundary);
}

/* ======================= composition ======================= */

void main() {
    vec2 p = discPoint(vUv);
    float disc = discMask(length(p));

    // Contraction: this pixel shows the tissue that sat at restPoint when the structure was baked.
    Ray ray = rayOf(p);
    float w = widthOf(ray, uPupil);
    vec4 structure = texture(uIris, restPoint(ray, w) * 0.5 + 0.5);

    vec3 col = zoneTones(structure);
    col = openingLayer(col, structure);
    col = mix(col, debugLayer(col, structure, w, ray.t), uDebug);
    col = mix(col, uPupilColor, pupilMask(w));

    float a = disc * uAlpha;
    // Premultiplied alpha: the canvas is composited that way.
    outColor = vec4(col * a, a);
}
`;

/** Every knob the shaders expose; the host copies these into uniforms at build time. */
export const IRIS_DEFAULTS = {
  uPupil: 0.3, // live pupil radius, a fraction of the iris radius; the bake sits at REST_PUPIL
  uPupilCentre: [0.02, 0.02], // the pupil's offset from the iris centre, in iris radii: nasal and superior; x flips for the other eye
  uPupilWobble: 0.006, // the margin's departure from a circle, as a fraction of its radius
  uPupilColor: [0, 0, 0],
  uCollarette: 0.3, // the collarette's position across the width, 0 at the margin, 1 at the root
  uRuffDepth: 0.025, // the frill's depth in width, about 0.1 mm
  uRuffCrenation: 0.5, // how far the frill's edge swings either side of its depth, as a fraction of it
  uRuffShade: 0.05, // how far the margin shadow reaches in width before it has faded to a third
  uEpitheliumColor: [0.22, 0.13, 0.09], // the pigment epithelium, seen through every opening: band-iris's dark brown
  uDebug: 1, // the coordinate lines; 0 hides them
} as const;

/** Knobs the bake reads; a change to any of them re-bakes. The rest are present-only. */
export const IRIS_BAKE_KEYS = [
  'uCollarette',
  'uPupilCentre',
  'uPupilWobble',
  'uRuffDepth',
  'uRuffCrenation',
  'uRuffShade',
] as const satisfies readonly (keyof typeof IRIS_DEFAULTS)[];
