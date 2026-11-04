/// <reference types="@figma/plugin-typings" />
import type { Suggestion } from '../../shared/types';
import type { RawIssue, ScanContext, TextStyleInfo } from '../scan/context';
import { fontLabel } from '../scan/node-info';
import type { Rule } from './types';

const sameLineHeight = (a: LineHeight, b: LineHeight) =>
  a.unit === 'AUTO' ? b.unit === 'AUTO' : b.unit !== 'AUTO' && a.unit === b.unit && Math.abs(a.value - b.value) < 0.01;
const sameLetterSpacing = (a: LetterSpacing, b: LetterSpacing) => a.unit === b.unit && Math.abs(a.value - b.value) < 0.01;

function hasTypographyVariables(node: TextNode): boolean {
  const bv = node.boundVariables;
  if (!bv) return false;
  return Boolean(bv.fontSize?.length || bv.fontFamily?.length || bv.fontStyle?.length || bv.fontWeight?.length || bv.lineHeight?.length);
}

function styleSummary(s: TextStyleInfo): string {
  return fontLabel(s.fontName, s.fontSize, s.lineHeight);
}

function matchTextStyle(node: TextNode, ctx: ScanContext): { confidence: 'exact' | 'close' | 'none'; best?: TextStyleInfo; alts: TextStyleInfo[] } {
  const font = node.fontName as FontName;
  const size = node.fontSize as number;
  const lh = node.lineHeight as LineHeight;
  const ls = node.letterSpacing as LetterSpacing;
  const exact: TextStyleInfo[] = [];
  const close: TextStyleInfo[] = [];
  for (const s of ctx.textStyles) {
    if (s.fontName.family !== font.family) continue;
    if (Math.abs(s.fontSize - size) >= 0.01) continue;
    if (s.fontName.style === font.style && sameLineHeight(s.lineHeight, lh) && sameLetterSpacing(s.letterSpacing, ls)) exact.push(s);
    else close.push(s);
  }
  const prefLocal = (a: TextStyleInfo, b: TextStyleInfo) => Number(a.remote) - Number(b.remote);
  exact.sort(prefLocal);
  close.sort((a, b) => Number(a.fontName.style !== font.style) - Number(b.fontName.style !== font.style) || prefLocal(a, b));
  if (exact.length) return { confidence: 'exact', best: exact[0], alts: [...exact.slice(1, 3), ...close.slice(0, 2)] };
  if (close.length) return { confidence: 'close', best: close[0], alts: close.slice(1, 3) };
  return { confidence: 'none', alts: [] };
}

export const typographyRules: Rule[] = [
  {
    id: 'typography/no-text-style',
    types: ['TEXT'],
    check: (node, ctx) => {
      const text = node as TextNode;
      if (!text.characters.trim()) return;
      if (text.textStyleId === figma.mixed) return; // traité par mixed-styles
      if (text.textStyleId) return;
      if (hasTypographyVariables(text)) return;
      if (text.fontName === figma.mixed || text.fontSize === figma.mixed) return;
      const match = matchTextStyle(text, ctx);
      const current = fontLabel(text.fontName as FontName, text.fontSize as number, text.lineHeight as LineHeight);
      const hasStyles = ctx.textStyles.length > 0;
      let suggestion: Suggestion | undefined;
      if (match.best) {
        suggestion = {
          kind: 'style',
          id: match.best.id,
          label: match.best.name,
          value: styleSummary(match.best),
          confidence: match.confidence,
          source: match.best.remote ? 'Library' : 'Local',
          alternatives: match.alts.length
            ? match.alts.map((s) => ({ id: `style:${s.id}`, label: s.name, value: styleSummary(s) }))
            : undefined,
        };
      }
      const issue: RawIssue = {
        ruleId: 'typography/no-text-style',
        node,
        severity: match.confidence === 'exact' ? 'error' : hasStyles ? 'warning' : 'info',
        currentValue: current,
        suggestion,
        fixSafety: match.confidence === 'exact' ? 'safe' : match.confidence === 'close' ? 'review' : 'none',
        params: { confidence: match.confidence, hasStyles: hasStyles ? 1 : 0 },
        plan: match.best ? { kind: 'apply-text-style', nodeId: node.id, styleId: match.best.id } : undefined,
        alternativePlans: match.alts.length
          ? Object.fromEntries(match.alts.map((s) => [`style:${s.id}`, { kind: 'apply-text-style', nodeId: node.id, styleId: s.id }]))
          : undefined,
      };
      return [issue];
    },
  },
  {
    id: 'typography/mixed-styles',
    types: ['TEXT'],
    check: (node) => {
      const text = node as TextNode;
      if (!text.characters.trim()) return;
      const mixedStyle = text.textStyleId === figma.mixed;
      const mixedFont = text.fontName === figma.mixed || text.fontSize === figma.mixed;
      if (!mixedStyle && !mixedFont) return;
      const segments = text.getStyledTextSegments(['fontName', 'fontSize', 'textStyleId']).length;
      return [
        {
          ruleId: 'typography/mixed-styles',
          node,
          currentValue: `${segments} styles`,
          fixSafety: 'none',
          params: { segments, mixedStyle: mixedStyle ? 1 : 0 },
        },
      ];
    },
  },
  {
    id: 'typography/off-scale-size',
    types: ['TEXT'],
    check: (node, ctx) => {
      const text = node as TextNode;
      if (!text.characters.trim()) return;
      if (text.textStyleId || text.fontSize === figma.mixed) return;
      if (ctx.fontSizeScale.length < 3) return;
      if (hasTypographyVariables(text)) return;
      const size = text.fontSize as number;
      if (ctx.fontSizeScale.some((v) => Math.abs(v - size) < 0.01)) return;
      // Plus proche valeur de l'échelle.
      const nearest = ctx.fontSizeScale.reduce((best, v) => (Math.abs(v - size) < Math.abs(best - size) ? v : best), ctx.fontSizeScale[0]);
      return [
        {
          ruleId: 'typography/off-scale-size',
          node,
          currentValue: `${Math.round(size * 100) / 100} px`,
          suggestion: { kind: 'value', id: String(nearest), label: `${nearest} px`, confidence: 'close' },
          fixSafety: 'none',
          params: { size: Math.round(size * 100) / 100, nearest, scale: ctx.fontSizeScale.join(', ') },
        },
      ];
    },
  },
];
