/* The iris surface, face on: a procedural model of the human iris in its own anatomical
   coordinates. The angle around the pupil and the width across the iris, 0 at the pupil
   margin and 1 at the root, are the axes every structure is defined in; docs/anatomy.md has
   the names and the measurements. GLSL ES 3.00 (WebGL2 only), deliberately using none of its
   reserved words.

   Two passes. The bake draws the structure into a square texture at the rest pupil whenever
   a structural knob or the size changes. The present pass maps each screen pixel to the
   tissue it shows for the live pupil, so contraction is a radial remap of the sample point,
   then colours it: the pupil can move every frame for the cost of one texture read.

   The bake's four fields, one per channel. Every layer is one of two substances, the pale
   tissue of the anterior border layer and the dark pigment epithelium showing through where
   it thins, so no layer paints colour: red is tissue lightness, 0.5 the zone's own tone;
   green is opening depth, how much epithelium shows; blue is the signed offset from the
   collarette's path, which is zone membership; alpha is pigment. A second texture carries
   the fields the present pass scales with the pupil: red the contraction furrows, which
   deepen with dilation, green the radial furrows, which open with constriction. */

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
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outDynamics;

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
uniform float uFibreGaps;
uniform float uCollaretteWidth;
uniform float uCollaretteLight;
uniform float uCryptRing;
uniform float uCryptColumns;
uniform float uCryptJitter;
uniform float uCryptFraction;
uniform float uCryptFeather;
uniform float uCryptDepth;
uniform float uCryptBulge;
uniform float uTrabeculaeLight;
uniform float uTrabeculaeReach;
uniform float uMesh;
uniform float uMeshWidth;
uniform float uMeshTaper;
uniform float uBandReach;
uniform float uBandSoftness;
uniform float uBandBite;
uniform float uBandLight;
uniform float uFurrowCount;
uniform float uFurrowInner;
uniform float uFurrowOuter;
uniform float uFurrowWidth;
uniform float uPigmentPatches;
uniform float uPatchZone;
uniform float uPigmentFreckles;
uniform float uNoduleLight;
${COORDINATES}
/* ======================= primitives ======================= */

float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
    float a = hash21(p);
    return vec2(a, hash21(p + a + 7.31));
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

/* The stromal fibres: the collagen bundles of the anterior border layer, running from the
   margin toward the root. In the ciliary zone they are cords: separate strands, each
   continuous across the width, waving together, with dark gaps between them, forking on the
   way to the root. Perlin's marble in polar coordinates: a periodic carrier around the turn
   with the wander in its phase, so a cord never fades out as a noise ridge does, sharpened
   into a ridge with a gap to its neighbours. A second field at twice the count whose cords
   emerge one by one outward gives the forks. The pupillary zone, where the sphincter's tissue
   is finest, keeps fine fibres from stretched noise. The bundles fade toward the root by a
   knob, since some eyes lose them by mid width. */
#define FIBRE_FINE 720.0
#define FIBRE_CORDS 128.0
#define FIBRE_ACROSS 3.0
#define FIBRE_WAVE_CELLS 24.0

/* The wander: a slow noise, two cells across the width, so the waves are long and gentle. */
float fibreWave(float t, float w, float seed) {
    return irisFbm(vec2(t * FIBRE_WAVE_CELLS, w * 2.0), FIBRE_WAVE_CELLS, seed) - 0.5;
}

float fibreStreaks(float t, float w, float cellsT, float seed, float wave, float wander) {
    float tw = t + wave * wander / cellsT * 4.0;
    float n = irisFbm(vec2(tw * cellsT, w * FIBRE_ACROSS), cellsT, seed);
    float ridge = saturate(1.0 - abs(n - 0.5) * 2.5);
    return pow(ridge, uFibreSharpness);
}

/* A cord field: count cords around the turn, the wander in their phase in cord spacings so
   neighbours wave together, each cord with its own width, brightness and a small offset
   from a hash of its index, a soft ridge with a dark gap to the next. With forkFrom at or
   above zero each cord emerges at its own width past it, so the field's cords appear one by
   one between the cords of the field below. Returns light, 0 in the gaps. */
float fibreCords(float t, float w, float count, float seed, float wave, float wander, float forkFrom) {
    float x = t * count + wave * wander * 6.0;
    float i = floor(x);
    vec2 id = vec2(mod(i, count), seed);
    vec2 h = hash22(id);
    float centre = 0.5 + 0.2 * (hash21(id + 3.0) - 0.5);
    float width = 0.14 + 0.24 * h.x;
    float d = abs(x - i - centre) / width;
    float cord = pow(1.0 - smoothstep(0.0, 1.0, d), 1.2) * (0.45 + 0.55 * h.y);
    if (forkFrom < 0.0) return cord;
    float start = forkFrom + 0.5 * hash21(id + 7.0);
    return cord * smoothstep(start, start + 0.2, w);
}

/* deflect and crowd come from the web: the fibres are sampled where the openings have
   pushed them to, and their light scales with how densely they lie, so an opening's rim is
   bright because the collagen is bunched there and its floor is sparse. */
float stromalFibres(float t, float w, float offset, float deflect, float crowd) {
    float pupillary = 1.0 - smoothstep(-0.03, 0.03, offset);
    float fade = 1.0 - uFibreFade * smoothstep(0.3, 0.9, w);
    // One wander for both scales: the fine fibres ride the bundles they are part of, and
    // ripple on a shorter wave of their own, so they cross and rejoin rather than comb.
    float wave = fibreWave(t, w, 44.0);
    float ripple = irisFbm(vec2(t * 96.0, w * 5.0), 96.0, 45.0) - 0.5;
    float tf = t - deflect;
    float fine = fibreStreaks(tf, w, FIBRE_FINE, 41.0, wave + 0.7 * ripple, uFibreWave);
    // The cords, and the forks that emerge between them from a third of the width outward.
    float bundles = max(fibreCords(tf, w, FIBRE_CORDS, 43.0, wave, uFibreWave, -1.0),
                        fibreCords(tf, w, FIBRE_CORDS * 2.0, 45.0, wave, uFibreWave, 0.3));
    // Bundles are patchy: brighter and thicker here, thinner there, along and across.
    float patchy = 0.5 + irisFbm(vec2(t * 48.0, w * 3.0), 48.0, 47.0);
    // The pupillary zone is patchy by sector too, some sectors pale and dense, others thin
    // and slate; and its fine fibres bunch into clumps, with gaps between them where the
    // tissue thins over the sphincter and the zone's deep colour shows. The gaps stay clear
    // of the margin and its frill.
    float sectors = 0.3 + 1.4 * irisFbm(vec2(t * 14.0, w * 2.0), 14.0, 49.0);
    float clump = irisFbm(vec2(t * 110.0 + wave * 2.0, w * 2.5), 110.0, 51.0);
    float gaps = smoothstep(0.55, 0.35, clump) * pupillary * smoothstep(0.06, 0.18, w);
    float light = fine * pupillary * uFibreFine * sectors
                + bundles * patchy * mix(1.0, 0.6, pupillary) * fade;
    // Crowding scales the fibres' contrast about the tissue's tone, not their light, so
    // bunched collagen is a stronger weave and parted collagen a flatter one, and the mean
    // tone is untouched by the flow; the light's own end would clamp and drift it darker.
    return uFibreContrast * (light - 0.35) * crowd - uFibreGaps * gaps;
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
   epithelium shows, darkening away from the walls with fibres still running through.

   Three kinds of disorder keep it from reading as a lattice. The net's frame wanders: the
   rings undulate around the circle and the columns wander across the width, so no ring is a
   circle and no strand a straight ray. A fraction of the seeds are missing, so their
   neighbours grow into cells two or three times the size, as the big crypts are. And every
   wall has its own weight, so a strand thins to nothing here and thickens there, forking and
   breaking rather than tiling. */

#define NET_SPLIT 1.4
#define NET_SEED 41.7
#define NET_RINGS_IN 1.0
#define NET_RADIAL_WIDTH 0.025
#define NET_CROSS_WIDTH 0.008
#define NET_THINNING 0.7
#define NET_RING_WANDER 0.5
#define NET_COLUMN_WANDER 1.2
#define NET_DROPOUT 0.2

/* A seed's own hash, for the dropout and for the walls it shares. */
float netSeedHash(float j, float c, float columns) {
    return hash21(vec2(mod(c, columns), j) + 2.0 * NET_SEED);
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
    if (ring < 0.0) return floor(uCryptColumns * 1.5 + 0.5);
    return floor(uCryptColumns * pow(NET_SPLIT, ring) + 0.5);
}

/* The seed of column c in ring j as an offset from the point, in the disc's frame: arc
   around at the point's radius, and radial in disc radii. */
vec2 netSeedOffset(float j, float c, float columns, float t, float outward, float r) {
    // A missing seed: pushed out of reach, so its neighbours take its cell.
    if (netSeedHash(j, c, columns) < NET_DROPOUT) return vec2(1e3);
    vec2 h = hash22(vec2(mod(c, columns), j) + NET_SEED);
    // Seeds stray mostly around the circle, less along the radius, so the walls between
    // neighbours in a ring run radially, as the trabeculae do.
    vec2 jitter = 0.5 + (h - 0.5) * uCryptJitter * vec2(1.0, 0.6);
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

/* The flow of the fibres around an opening. Bundles that would pass through an open cell are
   displaced to either side of its seed, crowd there and rejoin beyond it: a bump along the
   arc, zero at the seed, peaking at about the cell's half width and gone by twice that, with
   a radial envelope the cell's height. Returns the displacement along the arc in x and its
   derivative in y, in disc radii, for the point at (dx, dy) from the seed. */
vec2 cryptFlow(vec2 d, float rx, float ry) {
    float u = d.x / rx;
    float bump = exp(-u * u) * exp(-(d.y * d.y) / (ry * ry));
    float shift = uCryptBulge * rx * u * bump;
    float slope = uCryptBulge * (1.0 - 2.0 * u * u) * bump;
    return vec2(shift, slope);
}

/* The mesh network: the trabeculae as an open-cell foam, smooth struts round in section
   that thicken into fillets where three meet, with rounded holes between. The struts are
   the web's walls given thickness from the wall distance; a smooth minimum over the walls
   makes the fillets. */
#define MESH_SMOOTH 0.02
#define MESH_LIP 0.006

float meshSmin(float a, float b) {
    float h = max(MESH_SMOOTH - abs(a - b), 0.0) / MESH_SMOOTH;
    return min(a, b) - h * h * MESH_SMOOTH * 0.25;
}

/* Returns the trabeculae in x, the crypt depth in y, the fibres' deflection around the
   openings in z as a turn, and their crowding in w: 1 where the fibres are undisturbed,
   above it where they bunch beside an opening, below it where they part over one. */
vec4 trabeculaeAndCrypts(float t, float w, float outward, out vec3 mesh) {
    mesh = vec3(0.0);
    // The web fades out by its reach and stops one ring inside the wreath: skip the rest.
    if (outward > uTrabeculaeReach + 0.12 || outward < -(NET_RINGS_IN + 0.5) * uCryptRing / 1.6) {
        return vec4(0.0, 0.0, 0.0, 1.0);
    }

    float r = REST_PUPIL + w * (1.0 - REST_PUPIL);

    /* The frame wanders: the point is looked up in a warped frame, so the rings undulate by
       up to half a ring height and the columns by about a cell, slowly, and the walls bend
       with them. The arc is still measured at the true radius. */
    float bend = irisFbm(vec2(t * 40.0, outward * 8.0), 40.0, 67.0) - 0.5;
    outward += (irisFbm(vec2(t * 9.0, outward * 2.0), 9.0, 63.0) - 0.5) * NET_RING_WANDER * uCryptRing
             + bend * 0.3 * uCryptRing;
    t += (irisFbm(vec2(t * 6.0, outward * 3.0), 6.0, 65.0) - 0.5 + bend * 0.5) * NET_COLUMN_WANDER / uCryptColumns;
    float ringHere = floor(ringSpace(outward) / uCryptRing);

    /* Pass 1: the owning seed. Seeds stray little along the radius, so the owner sits in this
       ring or the next either side; missing seeds can hand a cell to a column further off. */
    float md = 1e9;
    vec2 mr = vec2(0.0);
    float owner = 0.0;
    float ownerColumn = 0.0;
    for (float dj = -1.0; dj <= 1.0; dj += 1.0) {
        float j = ringHere + dj;
        float columns = netColumns(j);
        float column = floor(t * columns);
        for (float dc = -3.0; dc <= 3.0; dc += 1.0) {
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
    float meshDist = 1e9;
    float widthHere = 0.7 + 0.6 * irisFbm(vec2(t * 120.0, w * 6.0), 120.0, 59.0);
    float ownerHash = netSeedHash(owner, ownerColumn, netColumns(owner));
    // The flow: every open seed in the window pushes the fibres, the owner's included.
    vec2 flow = vec2(0.0);
    float ry = 0.5 * uCryptRing * (1.0 - REST_PUPIL);
    for (float dj = -1.0; dj <= 1.0; dj += 1.0) {
        float j = owner + dj;
        float columns = netColumns(j);
        float column = floor(t * columns);
        float width = netWallWidth(owner, j) * widthHere;
        float rx = PI * r / columns;
        for (float dc = -3.0; dc <= 3.0; dc += 1.0) {
            vec2 rr = netSeedOffset(j, column + dc, columns, t, outward, r);
            if (rr.x > 5e2) continue;
            if (j >= -NET_RINGS_IN && cryptOpen(j, column + dc, columns) > 0.5) {
                flow += cryptFlow(-rr, rx, ry);
            }
            vec2 diff = rr - mr;
            if (dot(diff, diff) < 1e-8) continue;
            float d = dot(0.5 * (mr + rr), normalize(diff));
            nearest = min(nearest, d);
            // The mesh's distance: a smooth minimum over the walls, so where three meet the
            // struts run together in a concave fillet rather than a corner.
            if (j >= 0.0 || owner >= 0.0) meshDist = meshSmin(meshDist, d);
            if (width <= 0.0) continue;
            // The wall's own weight, the same from either cell: some strands are faint
            // threads, some thick bundles.
            float other = netSeedHash(j, column + dc, columns);
            float weight = hash21(vec2(ownerHash + other, ownerHash * other) * 7.0 + NET_SEED);
            float wallWidth = width * (0.6 + 0.8 * weight);
            // A soft bump across the wall: a bundle with feathered flanks, not a line.
            strand = max(strand, (0.35 + 0.85 * weight) * pow(1.0 - smoothstep(0.0, wallWidth, d), 1.5));
        }
    }

    float reach = 1.0 - smoothstep(uTrabeculaeReach - 0.15, uTrabeculaeReach + 0.1, outward);
    float inside = owner < -NET_RINGS_IN ? 0.0 : 1.0;
    float open = cryptOpen(owner, ownerColumn, netColumns(owner)) * inside;
    // The opening is a lens around the seed, radially elongated as its cell is and a little
    // pointed at the ends, kept inside the walls; a merged cell holds a lens smaller than
    // itself with a wide rim of tissue round it.
    vec2 q = abs(mr) / (1.7 * vec2(PI * r / netColumns(owner), ry));
    float lens = pow(pow(q.x, 1.6) + pow(q.y, 1.6), 1.0 / 1.6);
    float floorShape = 1.0 - smoothstep(0.5, 1.0, lens);
    float crypt = open * min(floorShape, smoothstep(0.0, uCryptFeather, nearest)) * reach;
    /* The mesh: the walls as struts, round in section, their width a knob; the cells as
       holes that deepen away from the struts. Thick at the junctions by the smooth minimum. */
    // The struts taper outward: thick bundles by the collarette, filaments by the root.
    float meshWidth = uMeshWidth * (1.0 - uMeshTaper * smoothstep(0.3, 0.95, w));
    float strut = 1.0 - smoothstep(meshWidth - MESH_LIP, meshWidth + MESH_LIP, meshDist);
    float section = meshDist / meshWidth;
    float strutHeight = sqrt(saturate(1.0 - section * section));
    float hole = smoothstep(meshWidth, meshWidth + 0.05, meshDist);
    mesh = vec3(strut, strutHeight, hole) * reach * step(0.0, owner + NET_RINGS_IN + 0.5);
    // The displacement as a turn at this radius; the crowding is 1 less the slope, since
    // the picture at t shows the fibre that was displaced to it.
    float deflect = flow.x * reach / (2.0 * PI * r);
    float crowd = max(1.0 - flow.y * reach, 0.1);
    return vec4(strand * reach * inside, crypt, deflect, crowd);
}

/* ======================= periphery ======================= */

/* The peripheral ciliary zone: the soft, cloudy, pale band inside the limbus, where the
   anterior border layer thickens toward the root. Its inner edge reaches inward by a few
   slow lobes with finer bays on them, so the band thickens and thins around the circle; the
   edge is soft, its softness varying too, and bright fibres push it outward so it is ragged
   rather than drawn. Inside, the band is cloudy by a slow noise, and the fibres and strands
   beneath it show through since it only lightens the tissue. The limbal ring darkens it at
   the root in the present pass, with no edge anywhere. */
#define BAND_LOBES 3.0
#define BAND_BAYS 8.0
#define BAND_SOFT_CELLS 5.0

float peripheralBand(float t, float w, float fibres) {
    float reach = 0.7 * turnNoise(t, BAND_LOBES, 71.0) + 0.3 * turnNoise(t, BAND_BAYS, 73.0);
    float inner = 1.0 - uBandReach * (0.25 + 0.75 * reach);
    float softness = uBandSoftness * (0.5 + turnNoise(t, BAND_SOFT_CELLS, 79.0));
    float edge = inner + uBandBite * max(fibres, 0.0);
    float band = smoothstep(edge - softness, edge + softness, w);
    float cloud = 0.3 + 1.4 * irisFbm(vec2(t * 40.0, w * 10.0), 40.0, 83.0);
    return uBandLight * band * cloud;
}

/* ======================= furrows ======================= */

/* The contraction furrows: the concentric folds of the ciliary zone, the rings of a tree
   trunk, where the tissue bunches as the pupil dilates. Their number rises with age, a few
   in a young iris and a dozen in an old one, so the count is a knob. They lie across the
   outer half of the zone, spaced unevenly and densest a millimetre or so in from the root.
   All of them ride one slow wobble, as contour lines do, each with a small wobble of its
   own; each is a ring with breaks, fading out for a stretch here and there, varying in depth
   along its length, soft across and narrower when there are many. Baked at their pattern;
   the present pass deepens them with dilation. */
#define FURROW_MAX 12.0

float contractionFurrows(float t, float w) {
    float count = clamp(floor(uFurrowCount + 0.5), 0.0, FURROW_MAX);
    float spacing = (uFurrowOuter - uFurrowInner) / max(count, 1.0);
    float slowWobble = (turnNoise(t, 5.0, 90.0) - 0.5) * 0.05;
    float depth = 0.0;
    for (float i = 0.0; i < FURROW_MAX; i += 1.0) {
        if (i >= count) break;
        float seed = 91.0 + i * 7.0;
        // Its own place within its slot, the slots narrowing toward the root.
        float u = (i + 0.15 + 0.7 * hash21(vec2(i, 89.0))) / count;
        float at = mix(uFurrowInner, uFurrowOuter, sqrt(u)) + slowWobble
                 + (turnNoise(t, 40.0, seed + 3.0) - 0.5) * 0.3 * spacing;
        // A ring with breaks: present most of the way round, gone for a stretch or two.
        float presence = smoothstep(0.15, 0.4, turnNoise(t, 7.0, seed + 1.0));
        float along = 0.4 + 0.6 * turnNoise(t, 14.0, seed + 2.0);
        float width = min(uFurrowWidth, 0.5 * spacing) * (0.6 + 0.8 * turnNoise(t, 11.0, seed + 4.0));
        // A fold, not a line: a Gaussian valley, soft to its edges.
        float d = (w - at) / width;
        float line = exp(-2.0 * d * d);
        depth = max(depth, line * presence * along);
    }
    return depth;
}

/* The radial furrows: the deeper creases between fibre bundles, running straight out from
   the collarette toward the root, which open as the pupil constricts and the zone stretches.
   Unevenly spaced rays: of the candidate slots around the turn a fraction hold a ray, each
   at a random spot in its slot, each with its own length and a depth that varies along it,
   thin and soft across. Baked at their pattern; the present pass opens them with
   constriction. */
#define CREASE_SLOTS 72.0
#define CREASE_FRACTION 0.4
#define CREASE_WIDTH 0.022

float radialFurrows(float t, float w, float outward) {
    float r = REST_PUPIL + w * (1.0 - REST_PUPIL);
    float slot = floor(t * CREASE_SLOTS);
    float depth = 0.0;
    for (float dc = -1.0; dc <= 1.0; dc += 1.0) {
        float c = mod(slot + dc, CREASE_SLOTS);
        vec2 h = hash22(vec2(c, 131.0));
        if (h.x > CREASE_FRACTION) continue;
        float rayT = (c + 0.1 + 0.8 * h.y) / CREASE_SLOTS;
        // Arc distance to the ray at this radius, in disc radii; wraps at the seam.
        float dt = t - rayT;
        dt -= floor(dt + 0.5);
        float arc = abs(dt) * 2.0 * PI * r;
        vec2 h2 = hash22(vec2(c, 137.0));
        // A channel several bundles wide, its own width per ray, widening toward the root
        // as the bundles spread, soft to the edge: a valley between ridges, not a line.
        float width = CREASE_WIDTH * (0.35 + 1.3 * h2.x) * (0.7 + 0.6 * outward);
        float across = exp(-(arc * arc) / (width * width));
        // From just outside the wreath to its own end: most stop short of the iris's half
        // width, which is about 0.15 outward from the wreath, and only a few reach the root.
        float start = 0.03 + 0.06 * hash21(vec2(c, 141.0));
        float reach = h2.y * h2.y;
        float end = start + 0.05 + 0.85 * reach * reach;
        float along = smoothstep(start, start + 0.04, outward) * (1.0 - smoothstep(end - 0.06, end, outward));
        float vary = 0.6 + 0.4 * irisNoise(vec2(c, w * 6.0), CREASE_SLOTS, 139.0);
        depth = max(depth, across * along * vary);
    }
    return depth;
}

/* ======================= pigment ======================= */

/* Pigment: melanin in the anterior border layer, written as a density. Amber patches are
   sparse melanin over a broad area, from a slow noise thresholded softly, lying toward the
   periphery in one eye and toward the pupil in another. Freckles are dense melanin in small
   soft spots, scattered by cell, slightly elongated along the fibres. Wölfflin nodules are
   not pigment at all but pale knots of tissue near the root of light irises, so they go to
   the tissue field. Returns pigment density in x and nodule lightness in y. */
#define PATCH_CELLS 10.0
#define FRECKLE_CELLS 40.0
#define FRECKLE_ROWS 6.0
#define SPECK_CELLS 120.0
#define SPECK_ROWS 16.0
#define NODULE_CELLS 48.0

float spots(float t, float w, float cellsT, float rows, float seed, float chance, float radius) {
    vec2 p = vec2(t * cellsT, w * rows);
    vec2 i = floor(p);
    vec2 f = p - i;
    float best = 0.0;
    for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
        for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
            vec2 cell = i + vec2(dx, dy);
            vec2 id = vec2(mod(cell.x, cellsT), cell.y) + seed;
            vec2 h = hash22(id);
            if (h.x > chance) continue;
            vec2 centre = vec2(dx, dy) + 0.2 + 0.6 * hash22(id + 5.0);
            vec2 d = (f - centre) / vec2(1.0, 1.6);
            float size = radius * (0.5 + 1.0 * h.y);
            // Soft all the way to the centre: a stain in the tissue, not a dot on it.
            best = max(best, 1.0 - smoothstep(0.0, size, length(d)));
        }
    }
    return best;
}

vec2 pigment(float t, float w) {
    float patchZone = mix(1.0 - smoothstep(0.2, 0.5, w), smoothstep(0.5, 0.85, w), uPatchZone);
    float patches = smoothstep(0.5, 0.85, irisFbm(vec2(t * PATCH_CELLS, w * 4.0), PATCH_CELLS, 103.0));
    float amber = uPigmentPatches * patches * patchZone;
    // Freckles: a few larger stains and many tiny specks, clustered where the specks' noise
    // is dense, in the ciliary zone.
    float stains = spots(t, w, FRECKLE_CELLS, FRECKLE_ROWS, 107.0, 0.05 * uPigmentFreckles, 0.14);
    float specks = spots(t, w, SPECK_CELLS, SPECK_ROWS, 113.0, 0.12 * uPigmentFreckles, 0.2)
                 * smoothstep(0.4, 0.7, irisFbm(vec2(t * 12.0, w * 4.0), 12.0, 117.0));
    float freckles = max(stains, specks) * smoothstep(0.3, 0.5, w);
    float density = max(amber * 0.25, freckles * 0.85);
    float nodules = spots(t, w, NODULE_CELLS, 8.0, 109.0, 0.15, 0.3)
                  * smoothstep(0.75, 0.85, w) * (1.0 - smoothstep(0.93, 0.98, w));
    return vec2(density, uNoduleLight * nodules);
}

/* ======================= relief ======================= */

/* The surface height: the anterior border layer is not flat. Trabeculae stand up as bundles,
   the wreath as a ridge, the fibres as fine ridges; crypts are pits and the furrows grooves.
   Written as a height about a half so the present pass can light it, which is where the
   highlight and shadow of a textured iris come from. The furrows are taken at their baked
   pattern, so their relief does not deepen with the pupil; only their darkness does. */
float relief(float fibres, float wreath, vec4 net, vec3 tubes, float furrows, float creases) {
    float ridge = wreath / max(uCollaretteLight, 1e-3);
    // Crowded collagen stands higher and parted collagen lies lower: the rim of an opening
    // is a raised bundle because the fibres are bunched there, not because a wall is drawn.
    float bunch = clamp(net.w - 1.0, -1.0, 1.5);
    float web = 0.06 * net.x + 0.2 * bunch - 0.5 * net.y;
    // The mesh struts stand up in the round; the holes between them are the crypts.
    float wax = 0.4 * tubes.y - 0.6 * tubes.z;
    float height = 0.5 + 0.15 * fibres * (1.0 - 0.9 * tubes.x * uMesh) + 0.2 * ridge
                 + mix(web, wax, uMesh) - 0.25 * furrows - 0.2 * creases;
    return saturate(height);
}

/* ======================= composition ======================= */

void main() {
    vec2 p = discPoint(vUv);
    Ray ray = rayOf(p);
    float w = widthOf(ray, REST_PUPIL);

    /* Nothing samples the bake inside the rest pupil or beyond the root, since the present
       pass maps every screen pixel between the live margin and the root back into that band;
       a few texels of margin feed the mip levels and the bilinear edge. */
    if (w < -0.03 || ray.dist > ray.root + 0.02) {
        outColor = vec4(0.5, w < 0.0 ? 1.0 : 0.0, encodeOffset(w - uCollarette), 0.0);
        outDynamics = vec4(0.0);
        return;
    }

    float offset = w - collarettePath(ray.t);

    float outward = w - collaretteMean(ray.t);
    vec3 mesh;
    vec4 net = trabeculaeAndCrypts(ray.t, w, outward, mesh);
    vec3 tubes = mesh * uMesh;
    // Strands brighten and fade along their length.
    float along = 0.5 + 0.7 * irisFbm(vec2(ray.t * 90.0, w * 4.0), 90.0, 61.0);
    float fibres = stromalFibres(ray.t, w, offset, net.z, net.w);
    float wreath = collaretteWreath(ray.t, w, offset);
    vec2 melanin = pigment(ray.t, w);
    float band = peripheralBand(ray.t, w, fibres);
    float stroma = 0.5 + fibres + wreath + uTrabeculaeLight * net.x * along * (1.0 - uMesh)
                 + band + melanin.y;
    // A strut is smooth pale tissue; the fibres beneath show through it faintly. The ground
    // between struts is the stroma with its fibres, thin over the deep colour, not a pit.
    float wax = 0.58 + 0.15 * fibres + wreath + band + melanin.y;
    float tissue = mix(stroma, wax, tubes.x);
    float crypt = max(net.y * (1.0 - uMesh), tubes.z * 0.75);
    float opening = max(pupillaryRuff(w, ray.t), uCryptDepth * crypt);
    float zone = encodeOffset(offset);
    outColor = vec4(saturate(tissue), opening, zone, melanin.x);

    float furrows = contractionFurrows(ray.t, w);
    float creases = radialFurrows(ray.t, w, offset);
    outDynamics = vec4(furrows, creases, relief(fibres, wreath, net, tubes, furrows, creases), tubes.x);
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
uniform sampler2D uIrisDynamics;

/* ---- state ---- */
uniform float uPupil;
uniform vec3 uPupilColor;
uniform float uDebug;

/* ---- contraction ---- */
uniform float uFurrowRest;
uniform float uFurrowDeepen;
uniform float uCreaseRest;
uniform float uCreaseOpen;

/* ---- relief ---- */
uniform float uReliefSlope;
uniform float uReliefLight;

/* ---- cornea and lids ---- */
uniform float uCornea;
uniform float uLidShadow;

/* ---- palette ---- */
uniform vec3 uPupillaryColor;
uniform vec3 uPupillaryDeep;
uniform vec3 uCiliaryColor;
uniform vec3 uCiliaryDeep;
uniform vec3 uMeshColor;
uniform float uMeshSpread;
uniform vec3 uCollaretteColor;
uniform float uCollaretteTint;
uniform float uCollaretteBleed;
uniform vec3 uLimbalColor;
uniform float uLimbusStart;
uniform vec3 uEpitheliumColor;
uniform float uTissueWhiten;
uniform vec3 uPigmentColor;
uniform vec3 uFreckleColor;
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
   outside, and the collarette's own colour strongest on the path and bleeding outward along
   the tissue. Smooth fields; every texture above them is tissue or opening. Each zone has
   two colours: its tone where the tissue is of ordinary thickness, and its deep colour where
   the tissue is thin over the dark epithelium. In a blue eye the deep colour is a saturated
   cobalt, since thin stroma scatters blue over the dark ground, and in an amber zone it is
   brown-orange; so colour runs from deep through the tone to white, not from grey to white. */
struct Zone {
    vec3 tone;
    vec3 deep;
};

Zone zoneTones(float offset) {
    float pupillary = 1.0 - smoothstep(-0.02, 0.02, offset);
    Zone zone;
    zone.tone = mix(uCiliaryColor, uPupillaryColor, pupillary);
    zone.deep = mix(uCiliaryDeep, uPupillaryDeep, pupillary);
    float wreath = offset < 0.0 ? exp(offset / 0.03) : exp(-offset / uCollaretteBleed);
    zone.tone = mix(zone.tone, uCollaretteColor, wreath * uCollaretteTint);
    zone.deep = mix(zone.deep, uCollaretteColor * 0.5, wreath * uCollaretteTint);
    return zone;
}

/* Pigment by its density: sparse melanin is amber, light passing through it, dense melanin
   is dark brown. Laid on the zone tone under the tissue's lightness, since the border layer
   carries both and the fibres run through a stain. */
vec3 pigmentLayer(vec3 col, float density) {
    vec3 melanin = mix(uPigmentColor, uFreckleColor, saturate(density * 2.0 - 1.0));
    return mix(col, melanin, saturate(density * 2.0));
}

/* The limbal ring: the root darkening softly under the limbus, over everything, so the
   peripheral band fades into it with no edge. */
vec3 limbusLayer(vec3 col, float w) {
    return mix(col, uLimbalColor, smoothstep(uLimbusStart, 1.0, w));
}

/* Tissue lightness over the zone tone: below the zone's own tone it goes toward the zone's
   deep colour; above it the tone is multiplied, so bright fibres stay in the zone's hue and
   only whiten by the knob, and the gaps between them are saturated. Lightness multiplies
   colour rather than mixing it toward white: that is where a deep colour comes from. */
vec3 tissueLayer(Zone zone, float tissue) {
    float l = tissue * 2.0;
    if (l < 1.0) return mix(zone.deep, zone.tone, l);
    vec3 lit = zone.tone * (1.0 + (l - 1.0) * 0.9);
    return mix(lit, vec3(1.0), (l - 1.0) * uTissueWhiten * 0.6);
}

/* Openings onto the pigment epithelium. The ruff is the epithelium itself, folded into
   view; a crypt shows it through the thin stroma left in the opening, which keeps the zone's
   hue, so a blue eye's crypts are navy and an amber zone's are brown. */
vec3 openingLayer(vec3 col, Zone zone, float opening) {
    vec3 seen = mix(zone.deep * 0.45, uEpitheliumColor, smoothstep(0.75, 1.0, opening));
    return mix(col, seen, opening);
}

/* The furrows, scaled with the pupil: the contraction furrows deepen as the pupil dilates
   past rest and the tissue bunches, the radial furrows open as it constricts and the ciliary
   zone stretches. Joined to the static openings as a union, so a crypt and a furrow crossing
   it stay soft. */
float furrowLayer(float opening, vec4 dynamics) {
    float dilation = saturate((uPupil - REST_PUPIL) / (0.67 - REST_PUPIL));
    float constriction = saturate((REST_PUPIL - uPupil) / (REST_PUPIL - 0.17));
    float furrows = dynamics.r * (uFurrowRest + uFurrowDeepen * dilation);
    float creases = dynamics.g * (uCreaseRest + uCreaseOpen * constriction);
    return 1.0 - (1.0 - opening) * (1.0 - furrows) * (1.0 - creases);
}

/* The relief, lit: the baked height's gradient, taken over a fixed step in the bake so the
   slopes do not change with the canvas size, gives a surface normal; a fixed light from the
   upper left lights the flank of every bundle facing it and shades the one turned away, and
   darkens the rim of every pit. Forward differences from the height already sampled, two
   reads rather than four: the gradient sits half a step off the pixel, under a texel at the
   sizes an orb shows. Returns a factor on the colour, 1 on flat tissue. */
#define RELIEF_STEP 0.003
const vec3 RELIEF_LIGHT = normalize(vec3(-0.45, 0.55, 0.7));

float reliefLayer(vec2 rest, float height) {
    float hx = (texture(uIrisDynamics, rest + vec2(RELIEF_STEP, 0.0)).b - height) * 2.0;
    float hy = (texture(uIrisDynamics, rest + vec2(0.0, RELIEF_STEP)).b - height) * 2.0;
    vec3 n = normalize(vec3(-hx * uReliefSlope, -hy * uReliefSlope, 1.0));
    float lit = dot(n, RELIEF_LIGHT) / RELIEF_LIGHT.z;
    return 1.0 + uReliefLight * (lit - 1.0);
}

/* The pupil: the opening inside the margin, one pixel soft at any size. */
float pupilMask(float w) {
    float edge = fwidth(w);
    return 1.0 - smoothstep(-edge, edge, w);
}

/* Light is composed in linear light: the palette is sRGB, so the composed colour is decoded
   before the surface is lit and encoded after. */
vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

/* The cornea: a clear dome over the iris, face on, whose normal tilts outward with the
   radius. It reflects the room by Fresnel, a few percent straight on: a sky above and a dark
   floor below, a soft veil that lifts the top of the eye. No catchlight: a lit window is the
   room's business, not the iris's. The iris is seen through it, so the reflection is added
   over everything, the pupil included. */
#define CORNEA_DOME 0.55

vec3 corneaLayer(vec3 col, vec2 p) {
    vec3 n = normalize(vec3(p * CORNEA_DOME, 1.0));
    float fresnel = 0.02 + 0.98 * pow(1.0 - n.z, 5.0);
    vec3 r = 2.0 * n.z * n - vec3(0.0, 0.0, 1.0);
    vec3 room = mix(vec3(0.02, 0.02, 0.025), vec3(0.35, 0.4, 0.5), smoothstep(-0.4, 0.7, r.y));
    return col + room * fresnel * uCornea;
}

/* The upper lid's shadow: the eye sits under a lid and a brow, so its top is darker than
   its bottom. Zero for an iris shown bare. */
vec3 lidLayer(vec3 col, vec2 p) {
    return col * (1.0 - uLidShadow * smoothstep(0.1, 1.0, p.y));
}

/* The coordinate check: a line every tenth of the width and every fifteen degrees from the
   live coordinates, and the collarette's path in gold from the bake, so the gold line and the
   zone tone show the remap while the grid shows what it should be. */
vec3 debugLayer(vec3 col, vec4 structure, vec4 dynamics, float w, float t) {
    float lines = max(isoline(w * 10.0), isoline(t * 24.0));
    col = mix(col, vec3(0.15), lines * 0.6);
    // The dynamic fields in red and green, at full depth, so their patterns can be checked.
    col = mix(col, vec3(1.0, 0.2, 0.2), dynamics.r * 0.8);
    col = mix(col, vec3(0.2, 1.0, 0.2), dynamics.g * 0.8);
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
    vec2 rest = restPoint(ray, w) * 0.5 + 0.5;
    vec4 structure = texture(uIris, rest);
    vec4 dynamics = texture(uIrisDynamics, rest);

    Zone zone = zoneTones(decodeOffset(structure.b));
    // The mesh's struts are pale tissue of the zone's own hue; the collarette's colour spreads
    // outward along them from the pupillary zone and dies away by the spread. The holes show
    // the zone beneath.
    float spread = dynamics.a * (1.0 - smoothstep(0.0, uMeshSpread, decodeOffset(structure.b)));
    zone.tone = mix(zone.tone, uMeshColor, spread);
    zone.deep = mix(zone.deep, uMeshColor * 0.6, spread);
    // Pigment lies in the border layer with the fibres, so the tissue's lightness runs over it.
    zone.tone = pigmentLayer(zone.tone, structure.a);
    zone.deep = pigmentLayer(zone.deep, structure.a) * 0.6;
    vec3 col = tissueLayer(zone, structure.r);
    col = openingLayer(col, zone, furrowLayer(structure.g, dynamics));
    col = limbusLayer(col, w);
    col = mix(col, uPupilColor, pupilMask(w));
    // The surface is lit in linear light: the relief, the lid, then the cornea over it all.
    col = toLinear(col);
    col *= reliefLayer(rest, dynamics.b);
    col = lidLayer(col, p);
    col = corneaLayer(col, p);
    col = toSrgb(col);
    // Debug 1 is the coordinate overlay; 2 shows the lit height field alone, as clay.
    if (uDebug > 1.5) {
        col = toSrgb(vec3(0.3 + 0.5 * dynamics.b) * reliefLayer(rest, dynamics.b));
        col = mix(col, vec3(0.0), pupilMask(w));
    } else {
        col = mix(col, debugLayer(col, structure, dynamics, w, ray.t), uDebug);
    }

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
  uFibreGaps: 0.35, // how far the gaps between fibre clumps darken the pupillary zone
  uCollaretteWidth: 0.07, // the wreath's visible width in width units, about 0.3 mm
  uCollaretteLight: 0.3, // how far the wreath lightens the tissue on its crest
  uCryptRing: 0.2, // height of the ring of cells just outside the wreath, in width
  uCryptColumns: 56, // cells around the ring just outside the wreath; fewer is larger openings. Whole, and it re-seeds the web
  uCryptJitter: 0.9, // how far seeds stray from their cell centres; 0 is a regular lattice
  uCryptFraction: 1, // scales the fraction of cells that are open crypts
  uCryptFeather: 0.05, // how far into a crypt the darkening takes to reach full depth, in disc radii
  uCryptDepth: 0.7, // how much epithelium shows at a crypt's floor; below 1 keeps fibres in view
  uCryptBulge: 0.7, // how far an opening pushes the fibres aside, as a fraction of its cell's half width
  uTrabeculaeLight: 0.3, // how far the drawn bundle core lightens the tissue; the bunched fibres add the weave
  uTrabeculaeReach: 0.45, // how far outward from the wreath the web fades out, in width
  uMesh: 0, // the trabeculae as a mesh network of round struts in place of the drawn web; 1 is all mesh
  uMeshWidth: 0.03, // a strut's half width in disc radii by the collarette, about 0.18 mm
  uMeshTaper: 0.6, // how much of that width the struts lose by the root
  uBandReach: 0.4, // how far in from the root the pale band reaches at its widest, in width
  uBandSoftness: 0.08, // the base softness of its inner edge, in width; varies around this
  uBandBite: 0.15, // how far bright fibres push the band's edge outward
  uBandLight: 0.45, // how far the band lightens the tissue
  uFurrowCount: 6, // how many contraction furrows, rising with age: a few when young, a dozen when old
  uFurrowInner: 0.5, // the innermost contraction furrow, in width: 2 mm from the root
  uFurrowOuter: 0.88, // the outermost, half a millimetre from the root
  uFurrowWidth: 0.035, // a furrow's soft half-width in width, about 0.15 mm; narrower when crowded
  uFurrowRest: 0.18, // the contraction furrows' depth at the rest pupil (present-only)
  uFurrowDeepen: 0.5, // how much deeper they are at full dilation (present-only)
  uCreaseRest: 0.25, // the radial furrows' depth at rest (present-only)
  uCreaseOpen: 0.35, // how much more they open at full constriction (present-only)
  uReliefSlope: 3, // how steep the baked height reads, a factor on its gradient (present-only)
  uReliefLight: 0.5, // how far the light's shading swings the colour; 0 is unlit (present-only)
  uCornea: 1, // the corneal reflection's strength: the room by Fresnel, no catchlight (present-only)
  uLidShadow: 0.25, // how far the upper lid darkens the top of the eye; 0 for a bare iris (present-only)
  uPigmentPatches: 0, // the amber patches' strength; band-iris has none
  uPatchZone: 1, // where the patches lie: 0 toward the pupil, 1 toward the periphery
  uPigmentFreckles: 0.3, // the freckles' density, 1 for a well-freckled iris
  uNoduleLight: 0.3, // how far Wölfflin nodules lighten the tissue near the root
  uPigmentColor: [0.85, 0.6, 0.25], // sparse melanin, amber
  uFreckleColor: [0.35, 0.18, 0.08], // dense melanin, dark brown
  // The palette: band-iris by default, the other presets in iris-palettes.ts.
  uPupillaryColor: [0.5, 0.57, 0.64],
  uPupillaryDeep: [0.28, 0.36, 0.5], // thin tissue in the pupillary zone: a slate blue
  uCiliaryColor: [0.28, 0.45, 0.62],
  uCiliaryDeep: [0.08, 0.2, 0.44], // thin tissue in the ciliary zone: cobalt over the epithelium
  uMeshColor: [0.82, 0.66, 0.34], // the colour that spreads outward along the mesh's struts from the collarette
  uMeshSpread: 0.45, // how far outward from the collarette that colour reaches along the struts, in width
  uCollaretteColor: [0.8, 0.85, 0.9],
  uCollaretteTint: 0, // how strongly the collarette's own colour shows; 0 leaves it as tissue
  uCollaretteBleed: 0.1, // how far outward the collarette's colour bleeds, in width
  uLimbalColor: [0.1, 0.14, 0.2],
  uLimbusStart: 0.9, // where the limbal darkening begins, in width
  uEpitheliumColor: [0.22, 0.13, 0.09], // the pigment epithelium, seen through every opening
  uTissueWhiten: 0.8, // how far the brightest tissue goes toward white
  uDebug: 0, // the coordinate overlay; 1 shows it
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
  'uFibreGaps',
  'uCollaretteWidth',
  'uCollaretteLight',
  'uCryptRing',
  'uCryptColumns',
  'uCryptJitter',
  'uCryptFraction',
  'uCryptFeather',
  'uCryptDepth',
  'uCryptBulge',
  'uTrabeculaeLight',
  'uTrabeculaeReach',
  'uMesh',
  'uMeshWidth',
  'uMeshTaper',
  'uBandReach',
  'uBandSoftness',
  'uBandBite',
  'uBandLight',
  'uFurrowCount',
  'uFurrowInner',
  'uFurrowOuter',
  'uFurrowWidth',
  'uPigmentPatches',
  'uPatchZone',
  'uPigmentFreckles',
  'uNoduleLight',
] as const satisfies readonly (keyof typeof IRIS_DEFAULTS)[];
