/* The pupil light reflex, after Pamplona, Oliveira and Baranoski, "Photorealistic models for
   pupil light reflex and iridal pattern deformation", ACM Transactions on Graphics 28(4),
   2009, whose equations and constants are extracted in docs/research/2026-09-20-iris-models.md.

   Their model is a delay-differential equation on the pupil diameter D in millimetres:

       (dM/dD)(dD/dt) + 2.3026 atanh((D - 4.9) / 3) = 5.2 - 0.45 ln(φ(t - τ) / φ̄)

   with M(D) = atanh((D - 4.9) / 3) from Moon and Spencer's equilibrium curve, φ the retinal
   light flux in lumens (the luminance over the pupil's area) delayed by the latency τ, and
   φ̄ the retinal threshold. The latency is Link and Stark's, and the time step is asymmetric
   so constriction runs about three times faster than redilation, scaled by a speed constant
   the paper fitted to two subjects. Hippus, whose cause is unknown, is what the paper did:
   a small band-limited perturbation of the luminance at 0.05 to 0.3 Hz.

   The individual-variability remap of the paper's equations 18 to 20 is not applied: the
   polynomial coefficients as transcribed in the report do not evaluate to sane diameters,
   and could not be checked against the paper.

   Nothing here allocates per step. */

/** Retinal threshold flux in lumens, from a 7.8272 mm pupil at 1e-5 blondels. */
const PHI_THRESHOLD = 4.8118e-10;
/** One blondel is 1e-6 lumens per square millimetre for a Lambertian surface. */
const LUMENS_PER_MM2_PER_BLONDEL = 1e-6;
/** One blondel in foot-lamberts, for the latency formula. */
const FOOT_LAMBERTS_PER_BLONDEL = 0.0929;
/** Physiological bounds of the diameter, in millimetres. */
const D_MIN = 1.5;
const D_MAX = 9;
const D_CENTRE = 4.9;
const D_HALF_RANGE = 3;
const LN10 = 2.3026;

/** History ring for the delayed flux: enough for a second of latency at any frame rate. */
const HISTORY = 512;

export type PupilDynamicsOptions = {
  /** The paper's speed constant; larger is slower. 600 fitted their subjects. */
  speed?: number;
  /** Depth of the hippus perturbation in natural-log units of flux. */
  hippus?: number;
};

export type PupilDynamics = {
  /** Diameter in millimetres. */
  readonly diameter: number;
  /**
   * Advances the reflex by dtMs under a scene luminance given as log10 blondels, with or
   * without hippus. Returns the new diameter in millimetres.
   */
  step(dtMs: number, log10Blondels: number, hippus: boolean): number;
  /** Snaps to the equilibrium diameter for a luminance and clears the history. */
  reset(log10Blondels: number): void;
};

/** Moon and Spencer's equilibrium diameter for a luminance, solved with the paper's fit. */
export function equilibriumDiameter(log10Blondels: number): number {
  // Fixed-point iteration on D, since the flux depends on the pupil's own area.
  let d = D_CENTRE;
  for (let i = 0; i < 24; i++) {
    const lnPhi = fluxLn(log10Blondels, d);
    const m = (5.2 - 0.45 * (lnPhi - Math.log(PHI_THRESHOLD))) / LN10;
    d = D_CENTRE + D_HALF_RANGE * Math.tanh(m);
  }
  return d;
}

function fluxLn(log10Blondels: number, diameter: number): number {
  const luminance = Math.pow(10, log10Blondels) * LUMENS_PER_MM2_PER_BLONDEL;
  const area = Math.PI * (diameter / 2) * (diameter / 2);
  return Math.log(luminance * area);
}

/** Link and Stark's latency for a step change, in milliseconds, kept within sane bounds. */
function latencyMs(log10Blondels: number): number {
  const footLamberts = Math.pow(10, log10Blondels) * FOOT_LAMBERTS_PER_BLONDEL;
  const tau = 253 - 14 * Math.log(footLamberts);
  return Math.min(600, Math.max(150, tau));
}

export function createPupilDynamics(options: PupilDynamicsOptions = {}): PupilDynamics {
  const speed = options.speed ?? 600;
  const hippusDepth = options.hippus ?? 0.6;

  const times = new Float64Array(HISTORY);
  const fluxes = new Float64Array(HISTORY);
  let head = 0;
  let count = 0;
  let now = 0;
  let diameter = D_CENTRE;

  // Three incommensurate tones in the hippus band, phases fixed at creation.
  const hippusPhase = [Math.random() * 6.283, Math.random() * 6.283, Math.random() * 6.283];

  const hippusLn = (tSeconds: number): number =>
    hippusDepth *
    (0.5 * Math.sin(6.283 * 0.07 * tSeconds + hippusPhase[0]) +
      0.3 * Math.sin(6.283 * 0.13 * tSeconds + hippusPhase[1]) +
      0.2 * Math.sin(6.283 * 0.23 * tSeconds + hippusPhase[2]));

  const push = (t: number, lnPhi: number) => {
    times[head] = t;
    fluxes[head] = lnPhi;
    head = (head + 1) % HISTORY;
    if (count < HISTORY) count++;
  };

  /* The flux the retina saw at a past time: the newest sample at or before it, or the oldest
     held when the history is shorter than the latency. */
  const delayed = (t: number): number => {
    let i = (head - 1 + HISTORY) % HISTORY;
    for (let n = 0; n < count; n++) {
      if (times[i] <= t) return fluxes[i];
      i = (i - 1 + HISTORY) % HISTORY;
    }
    const oldest = (head - count + HISTORY) % HISTORY;
    return fluxes[oldest];
  };

  const reset = (log10Blondels: number) => {
    diameter = equilibriumDiameter(log10Blondels);
    head = 0;
    count = 0;
    now = 0;
    push(0, fluxLn(log10Blondels, diameter));
  };

  reset(1.7);

  return {
    get diameter() {
      return diameter;
    },
    step(dtMs, log10Blondels, hippus) {
      now += dtMs;
      let lnPhi = fluxLn(log10Blondels, diameter);
      if (hippus) lnPhi += hippusLn(now * 0.001);
      push(now, lnPhi);

      const lnPhiDelayed = delayed(now - latencyMs(log10Blondels));
      const rhs = 5.2 - 0.45 * (lnPhiDelayed - Math.log(PHI_THRESHOLD));
      const x = Math.min(0.995, Math.max(-0.995, (diameter - D_CENTRE) / D_HALF_RANGE));
      const residual = rhs - LN10 * Math.atanh(x);
      // dM/dD, the slope of the equilibrium curve's inverse at this diameter.
      const dMdD = 1 / (D_HALF_RANGE * (1 - x * x));
      // Constriction is fast, redilation about three times slower.
      const dtModel = dtMs / (residual < 0 ? speed : 3 * speed);
      diameter += (residual / dMdD) * dtModel;
      diameter = Math.min(D_MAX, Math.max(D_MIN, diameter));
      return diameter;
    },
    reset,
  };
}

/** The pupil radius as a fraction of a 12 mm iris's radius, what the shader takes. */
export function radiusFraction(diameterMm: number): number {
  return diameterMm / 12;
}
