/* What a device can be asked about itself when the iris will not mount. A phone that fails
   has no console to open, so the demo prints this in place of the eye and offers it for
   copying. Nothing here runs unless the mount already failed, and the probe context is
   released straight away: a device short of memory should not be made to carry two. */

export type ReportLine = { label: string; value: string };

type Probe = {
  gl: WebGL2RenderingContext | WebGLRenderingContext | null;
  /** Which context the device would give us, which is the first thing worth knowing. */
  version: '2' | '1' | 'none';
};

function probeContext(): Probe {
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) return { gl: gl2, version: '2' };
    const gl1 = canvas.getContext('webgl');
    if (gl1) return { gl: gl1, version: '1' };
  } catch {
    // A context that throws on creation is a context we do not have.
  }
  return { gl: null, version: 'none' };
}

const CONTEXT_VALUE: Record<Probe['version'], string> = {
  '2': 'yes',
  '1': 'no, WebGL1 only',
  none: 'no context at all',
};

/** The device facts that decide whether this model can run, in the order they matter. */
export function webglReport(stage: HTMLElement | null): ReportLine[] {
  const lines: ReportLine[] = [];
  const { gl, version } = probeContext();

  lines.push({ label: 'WebGL2', value: CONTEXT_VALUE[version] });

  if (gl) {
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    lines.push({
      label: 'Renderer',
      value: debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'masked',
    });
    lines.push({ label: 'Max texture', value: `${gl.getParameter(gl.MAX_TEXTURE_SIZE)} px` });
    lines.push({
      label: 'Frag uniforms',
      value: `${gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)} vec4`,
    });
    lines.push({ label: 'Varyings', value: `${gl.getParameter(gl.MAX_VARYING_VECTORS)} vec4` });
    if (version === '2') {
      // The bake writes two colour attachments, so anything under two cannot run it.
      const gl2 = gl as WebGL2RenderingContext;
      lines.push({ label: 'Draw buffers', value: String(gl2.getParameter(gl2.MAX_DRAW_BUFFERS)) });
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  const dpr = window.devicePixelRatio || 1;
  lines.push({ label: 'Device pixels', value: String(dpr) });
  if (stage) {
    const size = Math.floor(Math.min(stage.clientWidth, stage.clientHeight));
    lines.push({
      label: 'Stage',
      value: `${stage.clientWidth} x ${stage.clientHeight} css, ${Math.round(size * dpr)} px canvas`,
    });
  }
  lines.push({
    label: '100dvh',
    value: CSS.supports('height', '100dvh') ? 'supported' : 'not supported',
  });
  lines.push({ label: 'Agent', value: navigator.userAgent });

  return lines;
}

/** The whole report as one block of text, for the copy button. */
export function formatReport(headline: string, log: string, lines: ReportLine[]): string {
  const body = lines.map(({ label, value }) => `${label}: ${value}`).join('\n');
  return [headline, log, '', body].filter(Boolean).join('\n');
}
