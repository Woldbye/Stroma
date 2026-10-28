export type PixelDiff = {
  /** Mean absolute difference over RGB, in 0..255. */
  mean: number;
  /** Largest per-channel difference, in 0..255. */
  max: number;
  /** Fraction of pixels whose largest channel difference exceeds `threshold`. */
  over: number;
  /** The difference amplified for display, flipped to canvas orientation. */
  image: ImageData;
};

/** Reads the renderer's back buffer; must run in the same task as the render that filled it. */
export function readPixels(gl: WebGL2RenderingContext): Uint8Array<ArrayBuffer> {
  const { width, height } = gl.canvas;
  const out = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return out;
}

export function diffPixels(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  { amplify = 8, threshold = 8 } = {}
): PixelDiff {
  const image = new ImageData(width, height);
  const px = image.data;
  let sum = 0;
  let max = 0;
  let over = 0;
  for (let y = 0; y < height; y++) {
    // readPixels is bottom-up; ImageData is top-down.
    const srcRow = (height - 1 - y) * width * 4;
    const dstRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 4;
      const d = dstRow + x * 4;
      let pixelMax = 0;
      for (let c = 0; c < 3; c++) {
        const diff = Math.abs(a[s + c] - b[s + c]);
        sum += diff;
        if (diff > pixelMax) pixelMax = diff;
        px[d + c] = Math.min(255, diff * amplify);
      }
      px[d + 3] = 255;
      if (pixelMax > max) max = pixelMax;
      if (pixelMax > threshold) over++;
    }
  }
  const count = width * height;
  return { mean: sum / (count * 3), max, over: over / count, image };
}
