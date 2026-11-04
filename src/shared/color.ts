/** Utilitaires couleur purs : conversions, distance perceptuelle, contraste WCAG. */

export interface RGB01 {
  r: number;
  g: number;
  b: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function rgbToHex(c: RGB01, alpha?: number): string {
  const to = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  const base = `#${to(c.r)}${to(c.g)}${to(c.b)}`;
  if (alpha !== undefined && alpha < 0.999) return `${base}${to(alpha)}`;
  return base;
}

export function hexToRgb(hex: string): RGB01 | null {
  const m = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(m)) return null;
  return {
    r: parseInt(m.slice(0, 2), 16) / 255,
    g: parseInt(m.slice(2, 4), 16) / 255,
    b: parseInt(m.slice(4, 6), 16) / 255,
  };
}

/** Clé de comparaison exacte (8 bits par canal). */
export function colorKey(c: RGB01, alpha = 1): string {
  return rgbToHex(c) + '@' + Math.round(clamp01(alpha) * 100);
}

// --- Lab / ΔE76 -------------------------------------------------------------

function srgbToLinear(v: number): number {
  v = clamp01(v);
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function rgbToLab(c: RGB01): [number, number, number] {
  const r = srgbToLinear(c.r);
  const g = srgbToLinear(c.g);
  const b = srgbToLinear(c.b);
  // D65
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1.0;
  let z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function deltaE(a: RGB01, b: RGB01): number {
  const [l1, a1, b1] = rgbToLab(a);
  const [l2, a2, b2] = rgbToLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

// --- Contraste WCAG ---------------------------------------------------------

export function relativeLuminance(c: RGB01): number {
  return 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
}

export function contrastRatio(fg: RGB01, bg: RGB01): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Compose `fg` avec alpha sur `bg` (alpha blending simple). */
export function composite(fg: RGB01, alpha: number, bg: RGB01): RGB01 {
  const a = clamp01(alpha);
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

export type ContrastLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

/**
 * Évalue un ratio pour un texte. WCAG 2.x :
 * - texte normal : AA ≥ 4.5, AAA ≥ 7
 * - texte large (≥ 24 px, ou ≥ 18.66 px en gras) : AA ≥ 3, AAA ≥ 4.5
 */
export function isLargeText(fontSize: number, bold: boolean): boolean {
  return fontSize >= 24 || (bold && fontSize >= 18.66);
}

export function evaluateContrast(ratio: number, large: boolean): { level: ContrastLevel; passesAA: boolean; passesAAA: boolean } {
  const aa = large ? 3 : 4.5;
  const aaa = large ? 4.5 : 7;
  const passesAA = ratio >= aa;
  const passesAAA = ratio >= aaa;
  const level: ContrastLevel = passesAAA ? 'AAA' : passesAA ? (large ? 'AA-large' : 'AA') : 'fail';
  return { level, passesAA, passesAAA };
}

export function formatRatio(ratio: number): string {
  return `${(Math.round(ratio * 100) / 100).toFixed(2).replace(/\.?0+$/, '')}:1`;
}

/** Détecte un style de police "gras" à partir du nom de style Figma. */
export function isBoldStyle(style: string): boolean {
  return /bold|black|heavy|extra\s*bold|semi\s*bold|demi|700|800|900/i.test(style);
}
