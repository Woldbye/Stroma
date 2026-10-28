/* GPU time per frame through EXT_disjoint_timer_query_webgl2, where the browser exposes it.
   Results arrive frames later, so `poll` is called every frame and returns a measurement when
   one has landed. Wall-time fallback for browsers without the extension: `measureWall`. */

export type GpuTimer = {
  readonly supported: boolean;
  /** Starts a query if none is in flight; only one runs at a time to keep the sample honest. */
  begin(): void;
  end(): void;
  /** Milliseconds for the oldest finished query, or null when none has landed yet. */
  poll(): number | null;
  /** What the timer is doing, for the harness readout. */
  debug(): string;
  dispose(): void;
};

const MAX_IN_FLIGHT = 4;
/* Polls a query may go unanswered before it is written off. Results normally land within a
   few frames; a query lost while a fresh context settles would otherwise sit at the head of
   the queue and block every later one for the life of the page. */
const MAX_POLLS = 120;

export function createGpuTimer(gl: WebGL2RenderingContext): GpuTimer {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending: { query: WebGLQuery; polls: number }[] = [];
  let active: WebGLQuery | null = null;

  if (!ext) {
    return {
      supported: false,
      begin() {},
      end() {},
      poll: () => null,
      debug: () => 'no extension',
      dispose() {},
    };
  }

  let polls = 0;
  let landed = 0;
  let disjoints = 0;
  let expired = 0;

  return {
    supported: true,
    debug: () =>
      `pending ${pending.length} active ${active ? 1 : 0} polls ${polls} landed ${landed} expired ${expired} disjoint ${disjoints}`,
    begin() {
      if (active || pending.length >= MAX_IN_FLIGHT) return;
      const q = gl.createQuery();
      if (!q) return;
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      active = q;
    },
    end() {
      if (!active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push({ query: active, polls: 0 });
      active = null;
    },
    poll() {
      if (pending.length === 0) return null;
      polls++;
      // Read once per poll: reading it also resets it.
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
      if (disjoint) disjoints++;
      // Any finished query counts; a stale one is written off rather than left blocking.
      for (let i = 0; i < pending.length; i++) {
        const entry = pending[i];
        entry.polls++;
        if (gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE) as boolean) {
          pending.splice(i, 1);
          landed++;
          const ns = gl.getQueryParameter(entry.query, gl.QUERY_RESULT) as number;
          gl.deleteQuery(entry.query);
          // A disjoint event (power state change) invalidates the sample.
          return disjoint ? null : ns / 1e6;
        }
        if (entry.polls > MAX_POLLS) {
          pending.splice(i, 1);
          i--;
          expired++;
          gl.deleteQuery(entry.query);
        }
      }
      return null;
    },
    dispose() {
      if (active) gl.endQuery(ext.TIME_ELAPSED_EXT);
      for (const entry of pending) gl.deleteQuery(entry.query);
      pending.length = 0;
      active = null;
    },
  };
}

const fencePixel = new Uint8Array(4);

/* Chrome's `gl.finish()` returns before the GPU is done; a synchronous readback does not. */
const fence = (gl: WebGL2RenderingContext) =>
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, fencePixel);

/**
 * Wall-clock milliseconds per render, fenced at both ends by a readback. Includes submission
 * overhead, so it runs coarser than the timer query, but it works everywhere and measures the
 * reference and candidate the same way.
 */
export function measureWall(gl: WebGL2RenderingContext, render: () => void, frames = 20): number {
  fence(gl);
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) render();
  fence(gl);
  return (performance.now() - t0) / frames;
}
