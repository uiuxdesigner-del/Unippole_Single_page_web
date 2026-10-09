import { CanvasTexture, SRGBColorSpace } from "three";
import type { HeroLocation } from "./geo";

/**
 * Placeholder campaign creatives, painted on a canvas per city.
 * Replace with real artwork by setting `artwork` on a city in geo.ts
 * (e.g. drop files into public/images/creatives/ — 1024×384, 8:3 ratio).
 */
export const CREATIVE_SIZE = { width: 1024, height: 384 } as const;

const cache = new Map<string, CanvasTexture>();

function shade(hex: string, amount: number) {
  const value = parseInt(hex.slice(1), 16);
  const mix = (channel: number) => Math.round(Math.min(255, Math.max(0, channel + amount * 255)));
  const r = mix((value >> 16) & 255);
  const g = mix((value >> 8) & 255);
  const b = mix(value & 255);
  return `rgb(${r},${g},${b})`;
}

export function createCreativeTexture(city: HeroLocation) {
  const cached = cache.get(city.name);
  if (cached) return cached;

  const { width, height } = CREATIVE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  // Deep base with a diagonal brand-colour sweep.
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#0b1020");
  base.addColorStop(0.55, "#141b33");
  base.addColorStop(1, shade(city.color, -0.35));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const sweep = ctx.createLinearGradient(width * 0.45, 0, width, height);
  sweep.addColorStop(0, "rgba(0,0,0,0)");
  sweep.addColorStop(1, city.color);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = sweep;
  ctx.beginPath();
  ctx.moveTo(width * 0.58, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, height);
  ctx.lineTo(width * 0.42, height);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Concentric "reach" arcs as a visual motif.
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(width * 0.86, height * 0.5, 46 * i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(width * 0.86, height * 0.5, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `500 24px ${font}`;
  ctx.fillText(city.name.toUpperCase(), 64, 86);

  ctx.fillStyle = "#ffffff";
  ctx.font = `500 56px ${font}`;
  const words = city.tagline.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width * 0.6 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  lines.slice(0, 2).forEach((text, i) => ctx.fillText(text, 64, 168 + i * 68));

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `500 22px ${font}`;
  ctx.fillText("ADINN  ·  Onepole Network", 64, height - 52);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  cache.set(city.name, texture);
  return texture;
}
