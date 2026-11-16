// Spine colours: derived from each poster's dominant saturated colour,
// clamped into a band where white spine lettering stays legible.

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function toSpine(h, s, l) {
  // Near-grey posters keep a muted tone instead of being forced into colour.
  let sat = s < 0.12 ? s * 100 : clamp(s, 0.4, 0.75) * 100;
  let light = clamp(l, 0.34, 0.47) * 100;
  // Yellow belongs to "watched": push ochre/orange/yellow posters down to a deep amber-brown.
  if (h >= 25 && h <= 75 && sat > 12) { sat = Math.min(sat, 55); light = Math.min(light, 31); }
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${Math.round(light)}%)`;
}

export function hashColor(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return toSpine(h % 360, 0.55, 0.4);
}

export function hash01(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return (h % 1000) / 1000;
}

export function extractColor(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const w = 24, h = 36;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        let r = 0, g = 0, b = 0, weight = 0;
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          const max = Math.max(R, G, B), min = Math.min(R, G, B);
          const sat = max ? (max - min) / max : 0;
          const lum = (max + min) / 510;
          const wt = sat * sat * (lum > 0.1 && lum < 0.9 ? 1 : 0.15) + 0.004;
          r += R * wt; g += G * wt; b += B * wt; weight += wt;
        }
        const [hh, ss, ll] = rgbToHsl(r / weight, g / weight, b / weight);
        resolve(toSpine(hh, ss, ll));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
