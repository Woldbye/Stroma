import type { OGLRenderingContext, Program } from 'ogl';

// Lets callers tell a device capability failure from a plain bug.
export class ShaderLinkError extends Error {
  /** The driver's own words: the stage that would not compile, else the link log. */
  readonly log: string;

  constructor(message: string, log: string) {
    super(log ? `${message}: ${log}` : message);
    this.name = 'ShaderLinkError';
    this.log = log;
  }
}

/* ogl only console.warns on shader compile/link failure, leaving a blank canvas;
   asserting turns it into the mount-failure path so the fallback renders. A device that
   rejects the shader has no console to read, so the error carries the driver's text with it. */
export function assertProgramLinked(
  gl: OGLRenderingContext,
  program: Program,
  label: string
): void {
  if (gl.getProgramParameter(program.program, gl.LINK_STATUS)) return;

  /* A stage that failed to compile says why; the link log is often empty in that case, so
     ask the stages first and fall back to the program. */
  const stages: string[] = [];
  const shaders = [
    ['vertex', program.vertexShader],
    ['fragment', program.fragmentShader],
  ] as const;
  for (const [stage, shader] of shaders) {
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) continue;
    stages.push(`${stage}: ${gl.getShaderInfoLog(shader)?.trim() || 'no log'}`);
  }

  const log = stages.length
    ? stages.join('\n')
    : gl.getProgramInfoLog(program.program)?.trim() || 'no log';

  throw new ShaderLinkError(`${label} shader failed to link`, log);
}
