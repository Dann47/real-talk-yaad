/**
 * Accent colour helpers: presets, a picker palette, hex validation and
 * contrast maths so any accent the user picks stays readable.
 */

/** Royal Jade: rich enough for white text on buttons (4.9:1), bright enough to glow on the dark background. */
export const DEFAULT_ACCENT = '#07805C';

/** Earlier defaults: people still on these move to the new default automatically. */
export const OLD_DEFAULT_ACCENTS = ['#0B6E4F'];

export const ACCENT_PRESETS = [
  { name: 'Royal Jade', hex: '#07805C' },
  { name: 'Gold', hex: '#F2B705' },
  { name: 'Riddim Lime', hex: '#B8F44A' },
  { name: 'Pink', hex: '#FF7AA8' },
  { name: 'Sea Blue', hex: '#1D4ED8' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Sunset', hex: '#EA580C' },
] as const;

/** Accepts "#0B6E4F", "0b6e4f" or "#0B6" and returns "#0B6E4F", or null if invalid. */
export function normalizeHex(input: string): string | null {
  let value = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return `#${value.toUpperCase()}`;
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mixes `hex` toward `other`; amount 0 = hex, 1 = other. */
export function mix(hex: string, other: string, amount: number): string {
  const a = toRgb(hex);
  const b = toRgb(other);
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as [number, number, number]);
}

/** Black or white, whichever reads better on the colour. */
export function readableOn(hex: string): '#000000' | '#FFFFFF' {
  return contrastRatio(hex, '#000000') >= contrastRatio(hex, '#FFFFFF') ? '#000000' : '#FFFFFF';
}

/** The accent, nudged lighter or darker until it passes 4.5:1 as text on the background. */
export function readableAccent(accent: string, background: string): string {
  const toward = luminance(background) < 0.5 ? '#FFFFFF' : '#000000';
  let color = accent;
  for (let step = 1; step <= 10 && contrastRatio(color, background) < 4.5; step++) {
    color = mix(accent, toward, step / 10);
  }
  return color;
}

/** Every accent-derived colour the UI uses, for one background. */
export function accentColors(accent: string, background: string) {
  return {
    accent,
    onAccent: readableOn(accent),
    accentText: readableAccent(accent, background),
    accentSoft: mix(accent, background, 0.85),
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** Picker palette: 12 hues, each in a deep, middle and light tone. */
export const ACCENT_PALETTE: string[][] = [0.32, 0.48, 0.66].map((lightness) =>
  Array.from({ length: 12 }, (_, i) => hslToHex(i * 30, 0.78, lightness)),
);

/** The big cards' sheen: a lighter top corner fading into a deep shade of the accent. */
export function heroGradient(accent: string) {
  return `linear-gradient(135deg, ${mix(accent, '#FFFFFF', 0.14)} 0%, ${accent} 45%, ${mix(accent, '#000000', 0.5)} 100%)`;
}
