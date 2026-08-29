/**
 * colorExtraction — derive a color palette from album art for the Now Playing
 * backdrop. Canvas-based and dependency-free: the artwork is served same-origin
 * (via the Vite proxy), so getImageData does not taint the canvas, and we avoid
 * node-vibrant/colorthief bundler friction. Downsamples to a small canvas and
 * histograms colors in a reduced (4-bit/channel) space.
 */
export type RGB = [number, number, number];

export type Palette = {
  dominant: RGB; // most common color
  accent: RGB; // most saturated prominent color
  colors: RGB[]; // top swatches, most common first
  isDark: boolean; // is the dominant color dark? (drives text contrast)
};

export const DEFAULT_PALETTE: Palette = {
  dominant: [30, 30, 46],
  accent: [109, 94, 252],
  colors: [
    [30, 30, 46],
    [109, 94, 252],
    [217, 70, 160],
  ],
  isDark: true,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same-origin — deliberately NOT setting crossOrigin (which would require
    // CORS headers and could otherwise taint the canvas).
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export function luminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export function rgbString([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export async function extractPalette(url: string): Promise<Palette> {
  const img = await loadImage(url);
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return DEFAULT_PALETTE;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Histogram in 4-bit/channel buckets, averaging real colors per bucket.
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue; // skip transparent
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    e.count++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }

  if (buckets.size === 0) return DEFAULT_PALETTE;

  const sorted = [...buckets.values()]
    .map((e) => ({
      count: e.count,
      rgb: [
        Math.round(e.r / e.count),
        Math.round(e.g / e.count),
        Math.round(e.b / e.count),
      ] as RGB,
    }))
    .sort((a, b) => b.count - a.count);

  const colors = sorted.slice(0, 6).map((s) => s.rgb);
  const dominant = colors[0];
  // Accent: the most saturated among the prominent swatches (falls back to
  // dominant), so even a muted cover yields something with life.
  const accent =
    [...colors].sort((a, b) => saturation(b) - saturation(a))[0] ?? dominant;

  return {
    dominant,
    accent,
    colors,
    isDark: luminance(dominant) < 0.45,
  };
}
