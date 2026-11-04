/// <reference types="@figma/plugin-typings" />
/** Typographie (Pro) : longueur de ligne, line-height incohérent, casse des libellés, styles quasi identiques. */
import { labelCase, type LabelCase, inferComponentKind } from '../../shared/names';
import type { RawIssue, ScanContext } from '../scan/context';
import { ancestors } from '../scan/node-info';
import type { Rule } from './types';

const LABEL_KINDS = new Set(['button', 'icon-button', 'tab', 'chip', 'link']);
const MAX_CHARS_PER_LINE = 90;

function lineHeightPx(lh: LineHeight, size: number): number | null {
  if (lh.unit === 'PIXELS') return Math.round(lh.value * 10) / 10;
  if (lh.unit === 'PERCENT') return Math.round(((lh.value / 100) * size) * 10) / 10;
  return null;
}

function toCase(text: string, target: LabelCase): string {
  switch (target) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'sentence': {
      const lower = text.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    case 'title':
      return text
        .toLowerCase()
        .split(/(\s+)/)
        .map((w) => (/^\s+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join('');
    default:
      return text;
  }
}

function isLabelContext(node: SceneNode, ctx: ScanContext): boolean {
  const chain = ancestors(node, ctx).slice(0, 3);
  return chain.some((a) => LABEL_KINDS.has(inferComponentKind(a.name)));
}

export const typographyProRules: Rule[] = [
  {
    id: 'typography/line-length',
    types: ['TEXT'],
    check: (node) => {
      const text = node as TextNode;
      if (text.characters.length < 120 || text.textAutoResize === 'WIDTH_AND_HEIGHT') return;
      if (text.fontSize === figma.mixed) return;
      const size = text.fontSize as number;
      if (size <= 0) return;
      const perLine = text.width / (size * 0.5);
      if (perLine <= MAX_CHARS_PER_LINE) return;
      const chars = Math.round(perLine);
      return [
        {
          ruleId: 'typography/line-length',
          node,
          currentValue: `≈ ${chars}`,
          suggestion: { kind: 'value', id: '70', label: `≤ 80`, confidence: 'none' },
          fixSafety: 'none',
          params: { chars, width: Math.round(text.width), max: 80, size },
        },
      ];
    },
  },
  {
    id: 'typography/line-height-inconsistent',
    types: ['TEXT'],
    check: (node, ctx) => {
      const text = node as TextNode;
      if (text.textStyleId || text.fontSize === figma.mixed || text.fontName === figma.mixed || text.lineHeight === figma.mixed) return;
      const size = text.fontSize as number;
      const lh = lineHeightPx(text.lineHeight as LineHeight, size);
      if (lh === null) return;
      ctx.textMetrics.push({ node: text, family: (text.fontName as FontName).family, size, lineHeightPx: lh });
    },
    finalize: (ctx) => {
      const groups = new Map<string, ScanContext['textMetrics']>();
      for (const m of ctx.textMetrics) {
        const key = `${m.family}|${m.size}`;
        groups.set(key, [...(groups.get(key) ?? []), m]);
      }
      const out: RawIssue[] = [];
      for (const list of groups.values()) {
        if (list.length < 3) continue;
        const counts = new Map<number, number>();
        for (const m of list) counts.set(m.lineHeightPx, (counts.get(m.lineHeightPx) ?? 0) + 1);
        if (counts.size < 2) continue;
        const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
        for (const m of list) {
          if (m.lineHeightPx === mode) continue;
          out.push({
            ruleId: 'typography/line-height-inconsistent',
            node: m.node,
            currentValue: `${m.size} / ${m.lineHeightPx}`,
            suggestion: { kind: 'value', id: String(mode), label: `${m.size} / ${mode}`, value: `${mode} px`, confidence: 'close' },
            fixSafety: 'review',
            params: { size: m.size, lineHeight: m.lineHeightPx, mode, family: m.family, count: counts.get(mode) ?? 0 },
            plan: { kind: 'set-line-height', nodeId: m.node.id, px: mode },
          });
        }
      }
      return out;
    },
  },
  {
    id: 'typography/label-case',
    types: ['TEXT'],
    insideInstances: true,
    check: (node, ctx) => {
      const text = node as TextNode;
      const chars = text.characters.trim();
      if (!chars || chars.length > 40 || /\n/.test(chars)) return;
      if (!isLabelContext(text, ctx)) return;
      ctx.buttonLabels.push({ node: text, text: chars });
    },
    finalize: (ctx) => {
      const labels = ctx.buttonLabels.map((l) => ({ ...l, kase: labelCase(l.text) })).filter((l) => l.kase !== 'other');
      if (labels.length < 4) return;
      const counts = new Map<LabelCase, number>();
      for (const l of labels) counts.set(l.kase, (counts.get(l.kase) ?? 0) + 1);
      const [majority, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (n / labels.length < 0.6 || counts.size < 2) return;
      const out: RawIssue[] = [];
      for (const l of labels) {
        if (l.kase === majority) continue;
        const suggested = toCase(l.text, majority);
        out.push({
          ruleId: 'typography/label-case',
          node: l.node,
          currentValue: l.text,
          suggestion: { kind: 'value', id: majority, label: suggested, confidence: 'close' },
          fixSafety: 'none',
          params: { text: l.text, suggested, share: Math.round((n / labels.length) * 100) },
        });
      }
      return out;
    },
  },
  {
    id: 'typography/near-duplicate-styles',
    finalize: (ctx) => {
      const local = ctx.textStyles.filter((s) => !s.remote);
      const out: RawIssue[] = [];
      const reported = new Set<string>();
      for (let i = 0; i < local.length; i++) {
        for (let j = i + 1; j < local.length; j++) {
          const a = local[i];
          const b = local[j];
          if (a.fontName.family !== b.fontName.family || a.fontName.style !== b.fontName.style) continue;
          if (Math.abs(a.fontSize - b.fontSize) > 1) continue;
          const la = lineHeightPx(a.lineHeight, a.fontSize);
          const lb = lineHeightPx(b.lineHeight, b.fontSize);
          if (!(la === null && lb === null) && (la === null || lb === null || Math.abs(la - lb) > 2)) continue;
          const key = `${a.id}|${b.id}`;
          if (reported.has(key)) continue;
          reported.add(key);
          out.push({
            ruleId: 'typography/near-duplicate-styles',
            virtual: { id: a.id, name: a.name, type: 'TEXT_STYLE', path: ['Text styles'] },
            slot: b.id,
            currentValue: `${a.name} ≈ ${b.name}`,
            fixSafety: 'none',
            params: { a: a.name, b: b.name, font: `${a.fontName.family} ${a.fontName.style}`, sizeA: a.fontSize, sizeB: b.fontSize },
          });
        }
      }
      return out;
    },
  },
];
