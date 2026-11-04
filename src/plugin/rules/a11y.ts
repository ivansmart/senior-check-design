/// <reference types="@figma/plugin-typings" />
import { composite, contrastRatio, deltaE, evaluateContrast, formatRatio, isBoldStyle, isLargeText, rgbToHex } from '../../shared/color';
import { inferComponentKind } from '../../shared/names';
import type { RawIssue, ScanContext } from '../scan/context';
import { backgroundBehind, isInteractiveByReactions, resolveSolidPaint } from '../scan/node-info';
import { tokenLabel } from './match-color';
import type { Rule } from './types';

const INTERACTIVE_KINDS = new Set(['button', 'icon-button', 'link', 'checkbox', 'radio', 'toggle', 'chip', 'tab', 'select']);

async function instanceKind(node: InstanceNode): Promise<string> {
  try {
    const main = await node.getMainComponentAsync();
    if (!main) return 'unknown';
    const set = main.parent?.type === 'COMPONENT_SET' ? main.parent : null;
    return inferComponentKind(set ? set.name : main.name, (set ?? main).description);
  } catch {
    return 'unknown';
  }
}

export const a11yRules: Rule[] = [
  {
    id: 'a11y/text-contrast',
    types: ['TEXT'],
    insideInstances: true,
    check: async (node, ctx) => {
      const text = node as TextNode;
      if (!text.characters.trim()) return;
      if (text.fontSize === figma.mixed || text.fontName === figma.mixed) return;
      const fills = text.fills;
      const notVerifiable = (reason: string): RawIssue[] =>
        ctx.activeRules.has('a11y/contrast-not-verifiable')
          ? [{ ruleId: 'a11y/contrast-not-verifiable', node, currentValue: reason, fixSafety: 'none', params: { reason } }]
          : [];
      if (fills === figma.mixed) return notVerifiable('mixed');
      const visible = (fills as readonly Paint[]).filter((p) => p.visible !== false && (p.opacity ?? 1) > 0);
      if (!visible.length) return;
      if (visible.length > 1 || visible[0].type !== 'SOLID') return notVerifiable(visible[0].type === 'IMAGE' ? 'image' : 'gradient');
      const bg = await backgroundBehind(text, ctx);
      if (bg.kind === 'complex') return notVerifiable(bg.reason);
      if (bg.kind === 'unknown') return;
      const fg = await resolveSolidPaint(visible[0], text);
      const alpha = fg.alpha * (text.opacity ?? 1);
      const effectiveFg = alpha < 0.99 ? composite(fg.rgb, alpha, bg.rgb) : fg.rgb;
      const ratio = contrastRatio(effectiveFg, bg.rgb);
      const size = text.fontSize as number;
      const large = isLargeText(size, isBoldStyle((text.fontName as FontName).style));
      const result = evaluateContrast(ratio, large);
      const aaa = ctx.options.contrastLevel === 'AAA';
      if (aaa ? result.passesAAA : result.passesAA) return;
      const required = aaa ? (large ? 4.5 : 7) : large ? 3 : 4.5;

      // Token conforme le plus proche (couleur de texte compatible), proposé en "review".
      let best: { id: string; label: string; swatch: string; d: number } | undefined;
      for (const t of ctx.colors) {
        if (t.alpha < 0.99) continue;
        if (!(t.scopes.includes('ALL_SCOPES') || t.scopes.includes('ALL_FILLS') || t.scopes.includes('TEXT_FILL'))) continue;
        if (contrastRatio(t.rgb, bg.rgb) < required) continue;
        const d = deltaE(t.rgb, fg.rgb);
        if (d > 30) continue;
        if (!best || d < best.d) best = { id: t.id, label: tokenLabel(t), swatch: rgbToHex(t.rgb), d };
      }
      const index = (fills as readonly Paint[]).indexOf(visible[0]);
      return [
        {
          ruleId: 'a11y/text-contrast',
          node,
          currentValue: formatRatio(ratio),
          swatch: rgbToHex(effectiveFg),
          suggestion: best ? { kind: 'variable', id: best.id, label: best.label, swatch: best.swatch, confidence: 'close' } : undefined,
          fixSafety: best ? 'review' : 'none',
          params: {
            ratio: formatRatio(ratio),
            required: `${required}:1`,
            fg: rgbToHex(effectiveFg),
            bg: rgbToHex(bg.rgb),
            large: large ? 1 : 0,
            size: Math.round(size * 10) / 10,
            level: ctx.options.contrastLevel,
          },
          plan: best && index >= 0 ? { kind: 'bind-paint-variable', nodeId: node.id, prop: 'fills', index, variableId: best.id } : undefined,
        },
      ];
    },
  },
  { id: 'a11y/contrast-not-verifiable', types: ['TEXT'], insideInstances: true },
  {
    id: 'a11y/touch-target',
    types: ['INSTANCE', 'FRAME', 'COMPONENT'],
    check: async (node, ctx) => {
      let interactive = isInteractiveByReactions(node);
      let kind = 'unknown';
      if (node.type === 'INSTANCE') {
        kind = await instanceKind(node);
        if (INTERACTIVE_KINDS.has(kind)) interactive = true;
      } else if (node.type === 'COMPONENT') {
        const set = node.parent?.type === 'COMPONENT_SET' ? node.parent : null;
        kind = inferComponentKind(set ? set.name : node.name, (set ?? node).description);
        if (INTERACTIVE_KINDS.has(kind)) interactive = true;
      }
      if (!interactive) return;
      if (kind === 'link') return; // les liens inline sont exemptés (WCAG 2.5.8)
      const min = ctx.options.minTouchTarget;
      const w = Math.round(node.width * 10) / 10;
      const h = Math.round(node.height * 10) / 10;
      if (w >= min && h >= min) return;
      return [
        {
          ruleId: 'a11y/touch-target',
          node,
          currentValue: `${w} × ${h} px`,
          suggestion: { kind: 'value', id: String(min), label: `≥ ${min} × ${min} px`, confidence: 'exact' },
          fixSafety: 'none',
          params: { width: w, height: h, min, kind },
        },
      ];
    },
  },
  {
    id: 'a11y/text-too-small',
    types: ['TEXT'],
    insideInstances: true,
    check: (node, ctx) => {
      const text = node as TextNode;
      if (!text.characters.trim() || text.fontSize === figma.mixed) return;
      const size = text.fontSize as number;
      if (size >= ctx.options.minFontSize) return;
      return [
        {
          ruleId: 'a11y/text-too-small',
          node,
          severity: size < 10 ? 'warning' : 'info',
          currentValue: `${Math.round(size * 10) / 10} px`,
          suggestion: { kind: 'value', id: String(ctx.options.minFontSize), label: `≥ ${ctx.options.minFontSize} px`, confidence: 'exact' },
          fixSafety: 'none',
          params: { size: Math.round(size * 10) / 10, min: ctx.options.minFontSize },
        },
      ];
    },
  },
];
