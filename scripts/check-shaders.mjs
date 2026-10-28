/* The shaders, parsed as GLSL ES 3.00 before they can ship. ANGLE, behind Chrome and Firefox
   on the desktop, accepts words the language reserves; Apple's validator does not, so a shader
   can compile on every machine the model is built on and on no iPhone. The furrows' slow
   wobble, once called shared, cost a release that way: the page drew and the eye did not.

   The grammar is the language's own, so nothing here is a list kept by hand. What it reads is
   what the driver is handed: the strings the module exports, the coordinate chunk already
   interpolated into them.

   Quiet, because the parser does not expand the #defines and would otherwise call every macro
   an undefined variable. That leaves this a check of syntax and reserved words rather than of
   meaning: it catches what bit us, not every way a device can refuse a shader. */

import { parser } from '@shaderfrog/glsl-parser/index.js';
import { createJiti } from 'jiti';

const SHADER_MODULE = '../src/iris/iris-shaders.ts';

const shaderModule = await createJiti(import.meta.url).import(SHADER_MODULE);
const shaders = Object.entries(shaderModule).filter(([, value]) => typeof value === 'string');

if (shaders.length === 0) {
  console.error(`check-shaders: no shader strings exported from ${SHADER_MODULE}`);
  process.exit(1);
}

let refused = 0;

for (const [name, source] of shaders) {
  // The module names the vertex shader; everything else it exports is a fragment stage.
  const stage = name.endsWith('_VERT') ? 'vertex' : 'fragment';
  try {
    parser.parse(source, { quiet: true, stage, includeLocation: true });
  } catch (error) {
    refused += 1;
    const at = error.location?.start;
    // The line is the one the driver quotes back, since nothing has shifted the source.
    console.error(
      `${name}:${at?.line ?? '?'}:${at?.column ?? '?'}  ${error.message.split('\n')[0]}`
    );
    const text = at ? source.split('\n')[at.line - 1]?.trim() : '';
    if (text) console.error(`    ${text}`);
  }
}

if (refused > 0) {
  console.error(`\ncheck-shaders: ${refused} shader the language refuses, and so will iOS`);
  process.exit(1);
}

console.log(`check-shaders: ${shaders.length} shaders parse as GLSL ES 3.00`);
