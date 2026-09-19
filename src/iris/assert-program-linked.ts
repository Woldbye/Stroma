import type { OGLRenderingContext, Program } from 'ogl';

// Lets callers tell a device capability failure from a plain bug.
export class ShaderLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShaderLinkError';
  }
}

/* ogl only console.warns on shader compile/link failure, leaving a blank canvas;
   asserting turns it into the mount-failure path so the fallback renders. */
export function assertProgramLinked(
  gl: OGLRenderingContext,
  program: Program,
  label: string
): void {
  if (gl.getProgramParameter(program.program, gl.LINK_STATUS)) return;
  throw new ShaderLinkError(
    `${label} shader failed to link: ${gl.getProgramInfoLog(program.program) ?? ''}`
  );
}
