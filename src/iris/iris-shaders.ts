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
   green is opening depth, how much epithelium shows; blue is the signed offset from the
   collarette's path, which is zone membership; alpha is pigment. */

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

/* The signed offset from the collarette's path, in width units and positive outward, rides
   in the bake's blue channel, encoded linearly over ±OFFSET_RANGE with 0.5 on the path. The
   sign is the zone; the magnitude places the wreath, its colour bleed and the crypt rows. */
#define OFFSET_RANGE 0.6
float encodeOffset(float offset) {
    return saturate(0.5 + offset / (2.0 * OFFSET_RANGE));
}
float decodeOffset(float code) {
    return (code - 0.5) * (2.0 * OFFSET_RANGE);
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
uniform float uCollaretteZigzag;
uniform float uRuffDepth;
uniform float uRuffCrenation;
uniform float uRuffShade;
uniform float uFibreContrast;
uniform float uFibreFine;
uniform float uFibreFade;
uniform float uFibreWave;
uniform float uFibreSharpness;
uniform float uCollaretteWidth;
uniform float uCollaretteLight;
uniform float uCryptRing;
uniform float uCryptJitter;
uniform float uCryptFraction;
uniform float uCryptFeather;
uniform float uCryptDepth;
uniform float uTrabeculaeLight;
uniform float uTrabeculaeReach;
${COORDINATES}
/* ======================= primitives ======================= */

float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

/* Value noise around the circle: t is the turn in 0..1, periodic by wrapping the cell index,
   so no seam blend is needed. Cells must be whole. Smooth, or linear for a polyline. */
float turnNoise(float t, float cells, float seed) {
    float x = t * cells;
    float ix = floor(x);
    float fx = x - ix;
    fx = fx * fx * (3.0 - 2.0 * fx);
    float a = hash21(vec2(mod(ix, cells), seed));
    float b = hash21(vec2(mod(ix + 1.0, cells), seed));
    return mix(a, b, fx);
}

float turnPolyline(float t, float cells, float seed) {
    float x = t * cells;
    float ix = floor(x);
    float a = hash21(vec2(mod(ix, cells), seed));
    float b = hash21(vec2(mod(ix + 1.0, cells), seed));
    return mix(a, b, x - ix);
}

/* Value noise on the iris: p.x runs around the circle in cells, whole per turn so the field
   wraps without a seam, p.y across the width. */
float irisNoise(vec2 p, float cellsT, float seed) {
    vec2 i = floor(p);
    vec2 f = p - i;
    f = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, cellsT);
    float x1 = mod(i.x + 1.0, cellsT);
    float a = hash21(vec2(x0, i.y) + seed);
    float b = hash21(vec2(x1, i.y) + seed);
    float c = hash21(vec2(x0, i.y + 1.0) + seed);
    float d = hash21(vec2(x1, i.y + 1.0) + seed);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

/* Three octaves of it, normalised to 0..1, each octave doubling the cells. */
float irisFbm(vec2 p, float cellsT, float seed) {
    float sum = irisNoise(p, cellsT, seed) * 0.5
              + irisNoise(p * 2.0, cellsT * 2.0, seed + 31.0) * 0.25
              + irisNoise(p * 4.0, cellsT * 4.0, seed + 67.0) * 0.125;
    return sum / 0.875;
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

/* The collarette's path: the boundary between the zones, a zigzag polyline around the pupil
   with about fifty vertices per turn that alternate inward and outward by random amounts up
   to a tenth of the width, on a slower drift of a few lobes, with a finer raggedness on top.
   The vertex count is even so the alternation wraps. */
#define COLLARETTE_VERTICES 48.0
#define COLLARETTE_LOBES 5.0
#define COLLARETTE_RAGGED 90.0

float collaretteZigzag(float t) {
    // The vertices are spaced unevenly: a smooth warp of the turn moves them about.
    float warped = t + (turnNoise(t, 24.0, 19.0) - 0.5) * (1.4 / COLLARETTE_VERTICES);
    float x = warped * COLLARETTE_VERTICES;
    float ix = floor(x);
    float i0 = mod(ix, COLLARETTE_VERTICES);
    float i1 = mod(ix + 1.0, COLLARETTE_VERTICES);
    float a = (0.15 + 0.85 * hash21(vec2(i0, 11.0))) * (mod(i0, 2.0) * 2.0 - 1.0);
    float b = (0.15 + 0.85 * hash21(vec2(i1, 11.0))) * (mod(i1, 2.0) * 2.0 - 1.0);
    return mix(a, b, x - ix);
}

/* The path's slow mean, without the zigzag: what the crypt rows are measured from, so the
   cells sit between the spikes rather than following them. */
float collaretteMean(float t) {
    float drift = turnNoise(t, COLLARETTE_LOBES, 13.0) * 2.0 - 1.0;
    return uCollarette + uCollaretteZigzag * 0.5 * drift;
}

float collarettePath(float t) {
    float ragged = turnPolyline(t, COLLARETTE_RAGGED, 17.0) * 2.0 - 1.0;
    return collaretteMean(t) + uCollaretteZigzag * (collaretteZigzag(t) + 0.15 * ragged);
}

/* The stromal fibres: the radial streaks of the anterior border layer, collagen bundles
   running from the margin toward the root. Noise stretched along the width, its cells a few
   times longer than they are wide, ridged so the bright cores are streaks with feathered
   flanks, and warped around the circle by a slow noise so the streaks wander and cross
   rather than run straight. Two scales: fine fibres, dense in the pupillary zone where the
   sphincter's tissue is finest, and bundles at a quarter the count, which run the whole width
   and fade toward the root by a knob, since some eyes lose them by mid width. */
#define FIBRE_FINE 720.0
#define FIBRE_BUNDLES 180.0
#define FIBRE_ACROSS 3.0
#define FIBRE_WAVE_CELLS 24.0

float fibreStreaks(float t, float w, float cellsT, float seed) {
    // The wander: a slow noise, two cells across the width, so the waves are long and gentle.
    float wave = irisFbm(vec2(t * FIBRE_WAVE_CELLS, w * 2.0), FIBRE_WAVE_CELLS, seed + 3.0) - 0.5;
    float tw = t + wave * uFibreWave / cellsT * 4.0;
    float n = irisFbm(vec2(tw * cellsT, w * FIBRE_ACROSS), cellsT, seed);
    float ridge = saturate(1.0 - abs(n - 0.5) * 2.5);
    return pow(ridge, uFibreSharpness);
}

float stromalFibres(float t, float w, float offset) {
    float pupillary = 1.0 - smoothstep(-0.03, 0.03, offset);
    float fade = 1.0 - uFibreFade * smoothstep(0.3, 0.9, w);
    float fine = fibreStreaks(t, w, FIBRE_FINE, 41.0);
    float bundles = fibreStreaks(t, w, FIBRE_BUNDLES, 43.0);
    // Bundles are patchy: brighter and thicker here, thinner there, along and across.
    float patchy = 0.5 + irisFbm(vec2(t * 48.0, w * 3.0), 48.0, 47.0);
    float light = fine * pupillary * uFibreFine + bundles * patchy * mix(1.0, 0.6, pupillary) * fade;
    return uFibreContrast * (light - 0.35);
}

/* The collarette: the wreath, the thickest tissue of the iris, sitting on its path. A soft
   ridge across the offset whose width and brightness vary around the turn, so it thickens,
   thins and breaks; made of fibre-scale noise so it reads as bunched tissue rather than a
   stroke laid on the fibres beneath it. */
#define COLLARETTE_WIDTH_CELLS 36.0
#define COLLARETTE_LIGHT_CELLS 20.0

float collaretteWreath(float t, float w, float offset) {
    float width = uCollaretteWidth * (0.6 + 0.8 * turnNoise(t, COLLARETTE_WIDTH_CELLS, 23.0));
    // Asymmetric: the inner flank blends into the pupillary zone, the outer is sharper
    // where the crypts begin.
    float sigma = offset < 0.0 ? width * 0.7 : width * 0.35;
    float ridge = exp(-(offset * offset) / (2.0 * sigma * sigma));
    float along = 0.3 + 1.2 * turnNoise(t, COLLARETTE_LIGHT_CELLS, 29.0);
    float grain = 0.6 + 0.6 * irisFbm(vec2(t * 240.0, w * 8.0), 240.0, 53.0);
    return uCollaretteLight * ridge * along * grain;
}

/* ======================= trabeculae and crypts ======================= */

/* The trabeculae and the crypts of Fuchs are one structure: the anterior border layer's
   collagen bundles arch around the openings between them. A Voronoi web on a polar grid
   measured from the collarette's path, after Iryx's net. Rings step outward from the path,
   ring 0 holding the large crypts just outside the wreath, and two rings step inward for the
   smaller crypts of the pupillary zone; rings are taller than their cells are wide, so the
   cells are lens-shaped and radially elongated. Each ring has a whole number of columns
   around the circle, multiplying outward, so a strand leaving the wreath forks as it goes.
   Seeds jitter inside their cells. Distances are taken in the disc's frame, arc around and
   radius outward, so walls are true bisectors. The walls are the trabeculae, feathered and
   patchy; a fraction of the cells are open, and inside them the tissue is thin so the
   epithelium shows, darkening away from the walls with fibres still running through. */

#define NET_COLUMNS 56.0
#define NET_SPLIT 1.4
#define NET_SEED 41.7
#define NET_RINGS_IN 1.0
#define NET_RADIAL_WIDTH 0.025
#define NET_CROSS_WIDTH 0.008
#define NET_THINNING 0.7

vec2 hash22(vec2 p) {
    float a = hash21(p);
    return vec2(a, hash21(p + a + 7.31));
}

/* Rings in a stretched radial coordinate: shorter inside the wreath, shrinking outward. */
float ringSpace(float outward) {
    if (outward < 0.0) return outward * 1.6;
    if (outward < uCryptRing) return outward;
    return uCryptRing + (outward - uCryptRing) * 1.3;
}

float ringSpaceInverse(float s) {
    if (s < 0.0) return s / 1.6;
    if (s < uCryptRing) return s;
    return uCryptRing + (s - uCryptRing) / 1.3;
}

/* Whole, so the ring wraps without a seam. */
float netColumns(float ring) {
    if (ring < 0.0) return floor(NET_COLUMNS * 1.5 + 0.5);
    return floor(NET_COLUMNS * pow(NET_SPLIT, ring) + 0.5);
}

/* The seed of column c in ring j as an offset from the point, in the disc's frame: arc
   around at the point's radius, and radial in disc radii. */
vec2 netSeedOffset(float j, float c, float columns, float t, float outward, float r) {
    vec2 h = hash22(vec2(mod(c, columns), j) + NET_SEED);
    // Seeds stray mostly around the circle, little along the radius, so the walls between
    // neighbours in a ring run radially, as the trabeculae do.
    vec2 jitter = 0.5 + (h - 0.5) * uCryptJitter * vec2(1.0, 0.35);
    float dt = (c + jitter.x) / columns - t;
    float seedOutward = ringSpaceInverse((j + jitter.y) * uCryptRing);
    return vec2(dt * 2.0 * PI * r, (seedOutward - outward) * (1.0 - REST_PUPIL));
}

/* Width of the wall between a cell in ring a and one in ring b, in disc radii; 0 hides it.
   Radial walls are the trabeculae proper, thick at the wreath and thinning outward; the
   arches between rings are slighter. The wall between ring -1 and ring 0 lies under the
   wreath, drawn by its own layer. */
float netWallWidth(float a, float b) {
    float lo = min(a, b);
    // Inside the wreath the pupillary zone has crypts but no web: only its fibres.
    if (lo < 0.0) return 0.0;
    if (a == b) return NET_RADIAL_WIDTH * pow(NET_THINNING, a);
    return NET_CROSS_WIDTH * pow(NET_THINNING, lo);
}

/* Which cells are open: a fraction per ring, largest just outside the wreath, sparse
   further out and inside. */
float cryptOpen(float ring, float column, float columns) {
    float fraction = ring == 0.0 ? 0.55 : (ring == 1.0 ? 0.3 : (ring < 0.0 ? 0.15 : 0.12));
    return step(hash21(vec2(mod(column, columns), ring) + 3.0 * NET_SEED), fraction * uCryptFraction);
}

/* Returns the trabeculae in x and the crypt depth in y. */
vec2 trabeculaeAndCrypts(float t, float w, float outward) {
    float r = REST_PUPIL + w * (1.0 - REST_PUPIL);
    float ringHere = floor(ringSpace(outward) / uCryptRing);

    /* Pass 1: the owning seed. Rings are taller than the arc a column spans, so the nearest
       seed can sit two rings away. */
    float md = 1e9;
    vec2 mr = vec2(0.0);
    float owner = 0.0;
    float ownerColumn = 0.0;
    for (float dj = -2.0; dj <= 2.0; dj += 1.0) {
        float j = ringHere + dj;
        float columns = netColumns(j);
        float column = floor(t * columns);
        for (float dc = -2.0; dc <= 2.0; dc += 1.0) {
            vec2 rr = netSeedOffset(j, column + dc, columns, t, outward, r);
            float d = dot(rr, rr);
            if (d < md) {
                md = d;
                mr = rr;
                owner = j;
                ownerColumn = column + dc;
            }
        }
    }

    /* Pass 2: every wall of the owner's cell. The strongest wall is the strand; the nearest
       wall's distance shapes the crypt inside. */
    float strand = 0.0;
    float nearest = 1e9;
    float widthHere = 0.7 + 0.6 * irisFbm(vec2(t * 120.0, w * 6.0), 120.0, 59.0);
    for (float dj = -2.0; dj <= 2.0; dj += 1.0) {
        float j = owner + dj;
        float columns = netColumns(j);
        float column = floor(t * columns);
        float width = netWallWidth(owner, j) * widthHere;
        for (float dc = -3.0; dc <= 3.0; dc += 1.0) {
            vec2 rr = netSeedOffset(j, column + dc, columns, t, outward, r);
            vec2 diff = rr - mr;
            if (dot(diff, diff) < 1e-8) continue;
            float d = dot(0.5 * (mr + rr), normalize(diff));
            nearest = min(nearest, d);
            // A soft bump across the wall: a bundle with feathered flanks, not a line.
            if (width > 0.0) strand = max(strand, pow(1.0 - smoothstep(0.0, width, d), 1.5));
        }
    }

    float reach = 1.0 - smoothstep(uTrabeculaeReach - 0.15, uTrabeculaeReach + 0.1, outward);
    float inside = owner < -NET_RINGS_IN ? 0.0 : 1.0;
    float open = cryptOpen(owner, ownerColumn, netColumns(owner)) * inside;
    float crypt = open * smoothstep(0.0, uCryptFeather, nearest) * reach;
    return vec2(strand * reach * inside, crypt);
}

/* ======================= composition ======================= */

void main() {
    vec2 p = discPoint(vUv);
    Ray ray = rayOf(p);
    float w = widthOf(ray, REST_PUPIL);
    float offset = w - collarettePath(ray.t);

    vec2 net = trabeculaeAndCrypts(ray.t, w, w - collaretteMean(ray.t));
    // Strands brighten and fade along their length.
    float along = 0.5 + 0.7 * irisFbm(vec2(ray.t * 90.0, w * 4.0), 90.0, 61.0);
    float tissue = 0.5 + stromalFibres(ray.t, w, offset) + collaretteWreath(ray.t, w, offset)
                 + uTrabeculaeLight * net.x * along;
    float opening = max(pupillaryRuff(w, ray.t), uCryptDepth * net.y);
    float zone = encodeOffset(offset);
    float pigment = 0.0;
    outColor = vec4(saturate(tissue), opening, zone, pigment);
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
uniform vec3 uPupillaryColor;
uniform vec3 uCiliaryColor;
uniform vec3 uCollaretteColor;
uniform float uCollaretteTint;
uniform float uCollaretteBleed;
uniform vec3 uLimbalColor;
uniform float uLimbusStart;
uniform vec3 uEpitheliumColor;
uniform float uTissueWhiten;
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

/* The zone base tones: the pupillary zone inside the collarette's path, the ciliary zone
   outside, the collarette's own colour strongest on the path and bleeding outward along the
   tissue, and the limbal ring darkening softly toward the root. Smooth fields; every texture
   above them is tissue or opening. */
vec3 zoneTones(float offset, float w) {
    float pupillary = 1.0 - smoothstep(-0.02, 0.02, offset);
    vec3 col = mix(uCiliaryColor, uPupillaryColor, pupillary);
    float wreath = offset < 0.0 ? exp(offset / 0.03) : exp(-offset / uCollaretteBleed);
    col = mix(col, uCollaretteColor, wreath * uCollaretteTint);
    return mix(col, uLimbalColor, smoothstep(uLimbusStart, 1.0, w));
}

/* Tissue lightness over the zone tone: below the zone's own tone it darkens, above it goes
   toward white, so bright fibres are pale in the zone's hue. */
vec3 tissueLayer(vec3 col, float tissue) {
    float l = tissue * 2.0;
    return l < 1.0 ? col * l : mix(col, vec3(1.0), (l - 1.0) * uTissueWhiten);
}

/* Openings onto the pigment epithelium. The ruff is the epithelium itself, folded into
   view; a crypt shows it through the thin stroma left in the opening, which keeps the zone's
   hue, so a blue eye's crypts are navy and an amber zone's are brown. */
vec3 openingLayer(vec3 col, float opening) {
    vec3 seen = mix(col * 0.3, uEpitheliumColor, smoothstep(0.75, 1.0, opening));
    return mix(col, seen, opening);
}

/* The pupil: the opening inside the margin, one pixel soft at any size. */
float pupilMask(float w) {
    float edge = fwidth(w);
    return 1.0 - smoothstep(-edge, edge, w);
}

/* The coordinate check: a line every tenth of the width and every fifteen degrees from the
   live coordinates, and the collarette's path in gold from the bake, so the gold line and the
   zone tone show the remap while the grid shows what it should be. */
vec3 debugLayer(vec3 col, vec4 structure, float w, float t) {
    float lines = max(isoline(w * 10.0), isoline(t * 24.0));
    col = mix(col, vec3(0.15), lines * 0.6);
    float path = 1.0 - smoothstep(0.0, fwidth(structure.b) * 2.0, abs(structure.b - 0.5));
    return mix(col, vec3(1.0, 0.8, 0.3), path);
}

/* ======================= composition ======================= */

void main() {
    vec2 p = discPoint(vUv);
    float disc = discMask(length(p));

    // Contraction: this pixel shows the tissue that sat at restPoint when the structure was baked.
    Ray ray = rayOf(p);
    float w = widthOf(ray, uPupil);
    vec4 structure = texture(uIris, restPoint(ray, w) * 0.5 + 0.5);

    vec3 col = zoneTones(decodeOffset(structure.b), w);
    col = tissueLayer(col, structure.r);
    col = openingLayer(col, structure.g);
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
  uCollarette: 0.35, // the collarette's mean position across the width, 1.5 mm from the margin
  uCollaretteZigzag: 0.08, // the zigzag's swing either side of the mean, in width
  uRuffDepth: 0.025, // the frill's depth in width, about 0.1 mm
  uRuffCrenation: 0.5, // how far the frill's edge swings either side of its depth, as a fraction of it
  uRuffShade: 0.02, // how far the margin shadow reaches in width before it has faded to a third
  uFibreContrast: 0.45, // how far the fibres lighten and darken the tissue about the zone's tone
  uFibreFine: 0.4, // the fine fibres' weight in the pupillary zone, relative to the bundles
  uFibreFade: 0.5, // how much the bundles fade by the root; 1 loses them by mid width
  uFibreWave: 0.6, // how far the streaks wander around the circle, in fibre spacings
  uFibreSharpness: 4, // how narrow the bright cores are; higher is thinner streaks
  uCollaretteWidth: 0.07, // the wreath's visible width in width units, about 0.3 mm
  uCollaretteLight: 0.3, // how far the wreath lightens the tissue on its crest
  uCryptRing: 0.2, // height of the ring of cells just outside the wreath, in width
  uCryptJitter: 0.9, // how far seeds stray from their cell centres; 0 is a regular lattice
  uCryptFraction: 1, // scales the fraction of cells that are open crypts
  uCryptFeather: 0.05, // how far into a crypt the darkening takes to reach full depth, in disc radii
  uCryptDepth: 0.7, // how much epithelium shows at a crypt's floor; below 1 keeps fibres in view
  uTrabeculaeLight: 0.35, // how far the trabeculae lighten the tissue
  uTrabeculaeReach: 0.45, // how far outward from the wreath the web fades out, in width
  // The palette: band-iris by default, the other presets in iris-palettes.ts.
  uPupillaryColor: [0.5, 0.57, 0.64],
  uCiliaryColor: [0.28, 0.45, 0.62],
  uCollaretteColor: [0.8, 0.85, 0.9],
  uCollaretteTint: 0, // how strongly the collarette's own colour shows; 0 leaves it as tissue
  uCollaretteBleed: 0.1, // how far outward the collarette's colour bleeds, in width
  uLimbalColor: [0.1, 0.14, 0.2],
  uLimbusStart: 0.86, // where the limbal darkening begins, in width
  uEpitheliumColor: [0.22, 0.13, 0.09], // the pigment epithelium, seen through every opening
  uTissueWhiten: 0.8, // how far the brightest tissue goes toward white
  uDebug: 1, // the coordinate lines; 0 hides them
} as const;

/** Knobs the bake reads; a change to any of them re-bakes. The rest are present-only. */
export const IRIS_BAKE_KEYS = [
  'uCollarette',
  'uCollaretteZigzag',
  'uPupilCentre',
  'uPupilWobble',
  'uRuffDepth',
  'uRuffCrenation',
  'uRuffShade',
  'uFibreContrast',
  'uFibreFine',
  'uFibreFade',
  'uFibreWave',
  'uFibreSharpness',
  'uCollaretteWidth',
  'uCollaretteLight',
  'uCryptRing',
  'uCryptJitter',
  'uCryptFraction',
  'uCryptFeather',
  'uCryptDepth',
  'uTrabeculaeLight',
  'uTrabeculaeReach',
] as const satisfies readonly (keyof typeof IRIS_DEFAULTS)[];
