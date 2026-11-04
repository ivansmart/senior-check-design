/// <reference types="@figma/plugin-typings" />
import type { RGB01 } from '../../shared/color';
import { colorKey, deltaE, rgbToHex } from '../../shared/color';
import type { MatchConfidence, Suggestion, SuggestionAlternative } from '../../shared/types';
import type { ColorToken, PaintStyleInfo, ScanContext } from '../scan/context';

export type ColorUsage = 'frame-fill' | 'shape-fill' | 'text-fill' | 'stroke';

const CLOSE_DELTA_E = 2.5;
const AMBIGUOUS_GAP = 0.6;

function scopeAllows(scopes: VariableScope[], usage: ColorUsage): boolean {
  if (scopes.includes('ALL_SCOPES')) return true;
  switch (usage) {
    case 'frame-fill':
      return scopes.includes('ALL_FILLS') || scopes.includes('FRAME_FILL');
    case 'shape-fill':
      return scopes.includes('ALL_FILLS') || scopes.includes('SHAPE_FILL');
    case 'text-fill':
      return scopes.includes('ALL_FILLS') || scopes.includes('TEXT_FILL');
    case 'stroke':
      return scopes.includes('STROKE_COLOR');
  }
}

export interface ColorMatch {
  confidence: MatchConfidence;
  token?: ColorToken;
  style?: PaintStyleInfo;
  alternatives: { token?: ColorToken; style?: PaintStyleInfo }[];
  scopeMismatch: boolean;
}

export function tokenLabel(t: ColorToken): string {
  return t.modeName && !t.isDefaultMode ? `${t.name} (${t.modeName})` : t.name;
}

function rank(t: ColorToken, usage: ColorUsage): number {
  // Plus petit = meilleur : scope compatible, mode par défaut, local avant librairie.
  return (scopeAllows(t.scopes, usage) ? 0 : 4) + (t.isDefaultMode ? 0 : 2) + (t.remote ? 1 : 0);
}

/** Cherche la meilleure correspondance (variable puis style) pour une couleur. */
export function matchColor(rgb: RGB01, alpha: number, ctx: ScanContext, usage: ColorUsage): ColorMatch {
  const key = colorKey(rgb, alpha);
  const exactTokens = (ctx.colorByKey.get(key) ?? []).slice().sort((a, b) => rank(a, usage) - rank(b, usage));
  const exactStyles = ctx.paintStyleByKey.get(key) ?? [];

  if (exactTokens.length) {
    const best = exactTokens[0];
    const compatible = scopeAllows(best.scopes, usage);
    const alternatives = [
      ...exactTokens.slice(1, 4).map((t) => ({ token: t })),
      ...exactStyles.slice(0, 2).map((s) => ({ style: s })),
    ];
    return { confidence: compatible ? 'exact' : 'close', token: best, alternatives, scopeMismatch: !compatible };
  }
  if (exactStyles.length) {
    return { confidence: 'exact', style: exactStyles[0], alternatives: exactStyles.slice(1, 3).map((s) => ({ style: s })), scopeMismatch: false };
  }

  // Correspondance proche (ΔE) parmi les tokens de même opacité.
  const scored: { token: ColorToken; d: number }[] = [];
  for (const t of ctx.colors) {
    if (Math.abs(t.alpha - alpha) > 0.02) continue;
    if (!scopeAllows(t.scopes, usage)) continue;
    const d = deltaE(rgb, t.rgb);
    if (d <= CLOSE_DELTA_E) scored.push({ token: t, d });
  }
  scored.sort((a, b) => a.d - b.d || rank(a.token, usage) - rank(b.token, usage));
  if (scored.length) {
    const [first, second] = scored;
    const ambiguous = !!second && second.d - first.d <= AMBIGUOUS_GAP && colorKey(second.token.rgb, second.token.alpha) !== colorKey(first.token.rgb, first.token.alpha);
    return {
      confidence: ambiguous ? 'ambiguous' : 'close',
      token: first.token,
      alternatives: scored.slice(1, 4).map((s) => ({ token: s.token })),
      scopeMismatch: false,
    };
  }
  // Styles proches.
  const styleScored = ctx.paintStyles
    .filter((s) => Math.abs(s.alpha - alpha) <= 0.02)
    .map((s) => ({ style: s, d: deltaE(rgb, s.rgb) }))
    .filter((s) => s.d <= CLOSE_DELTA_E)
    .sort((a, b) => a.d - b.d);
  if (styleScored.length) {
    return { confidence: 'close', style: styleScored[0].style, alternatives: styleScored.slice(1, 3).map((s) => ({ style: s.style })), scopeMismatch: false };
  }
  return { confidence: 'none', alternatives: [], scopeMismatch: false };
}

export function toSuggestion(match: ColorMatch): Suggestion | undefined {
  if (match.confidence === 'none') return undefined;
  const alts: SuggestionAlternative[] = match.alternatives.map((a) =>
    a.token
      ? { id: `var:${a.token.id}`, label: tokenLabel(a.token), swatch: rgbToHex(a.token.rgb, a.token.alpha) }
      : { id: `style:${a.style!.id}`, label: a.style!.name, swatch: rgbToHex(a.style!.rgb, a.style!.alpha) },
  );
  if (match.token) {
    const t = match.token;
    return {
      kind: 'variable',
      id: t.id,
      label: tokenLabel(t),
      swatch: rgbToHex(t.rgb, t.alpha),
      confidence: match.confidence,
      source: t.source === 'Local' ? t.collection || 'Local' : `${t.source} · ${t.collection}`,
      alternatives: alts.length ? alts : undefined,
    };
  }
  const s = match.style!;
  return {
    kind: 'style',
    id: s.id,
    label: s.name,
    swatch: rgbToHex(s.rgb, s.alpha),
    confidence: match.confidence,
    source: s.remote ? 'Library' : 'Local',
    alternatives: alts.length ? alts : undefined,
  };
}
