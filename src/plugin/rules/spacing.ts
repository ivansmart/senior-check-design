/// <reference types="@figma/plugin-typings" />
import { isOnGrid, matchScale, px, type ScaleCandidate } from '../../shared/scale';
import type { Suggestion } from '../../shared/types';
import type { FixPlan } from '../fix/plans';
import type { FloatToken, RawIssue, ScanContext } from '../scan/context';
import { hasAutoLayout } from '../scan/node-info';
import type { Rule } from './types';

type NumericField = Extract<VariableBindableNodeField, 'paddingLeft' | 'paddingRight' | 'paddingTop' | 'paddingBottom' | 'itemSpacing' | 'counterAxisSpacing' | 'topLeftRadius' | 'topRightRadius' | 'bottomLeftRadius' | 'bottomRightRadius'>;

const LAYOUT_TYPES: NodeType[] = ['FRAME', 'COMPONENT'];
const RADIUS_TYPES: NodeType[] = ['FRAME', 'COMPONENT', 'RECTANGLE'];

function floatLabel(t: FloatToken): string {
  return t.name;
}

function describe(match: ReturnType<typeof matchScale<FloatToken>>): Suggestion | undefined {
  if (!match.best) return undefined;
  const alts = match.candidates.slice(1).map((c) => ({ id: `var:${c.ref.id}`, label: floatLabel(c.ref), value: px(c.value) }));
  return {
    kind: 'variable',
    id: match.best.ref.id,
    label: floatLabel(match.best.ref),
    value: px(match.best.value),
    confidence: match.confidence,
    source: match.best.ref.source === 'Local' ? match.best.ref.collection || 'Local' : `${match.best.ref.source} · ${match.best.ref.collection}`,
    alternatives: alts.length ? alts : undefined,
  };
}

/**
 * Évalue une valeur numérique non liée contre une échelle de tokens (ou la grille de base).
 * Retourne null si la valeur est acceptable.
 */
export function evaluateNumber(
  ruleId: string,
  node: SceneNode,
  fields: NumericField[],
  value: number,
  scale: ScaleCandidate<FloatToken>[],
  ctx: ScanContext,
  opts: { tolerance: number; gridFallback: boolean; label: string },
): RawIssue | null {
  if (scale.length) {
    const match = matchScale(value, scale, opts.tolerance);
    if (match.confidence === 'exact') {
      return {
        ruleId,
        node,
        slot: fields.join('+'),
        severity: 'error',
        currentValue: px(value),
        suggestion: describe(match),
        fixSafety: 'safe',
        params: { fields: fields.join(', '), label: opts.label, confidence: 'exact' },
        plan: { kind: 'bind-number', nodeId: node.id, fields, variableId: match.best!.ref.id },
      };
    }
    const plan: FixPlan | undefined = match.best ? { kind: 'bind-number', nodeId: node.id, fields, variableId: match.best.ref.id } : undefined;
    const alternativePlans = Object.fromEntries(
      match.candidates.slice(1).map((c) => [`var:${c.ref.id}`, { kind: 'bind-number', nodeId: node.id, fields, variableId: c.ref.id } as FixPlan]),
    );
    return {
      ruleId,
      node,
      slot: fields.join('+'),
      severity: 'warning',
      currentValue: px(value),
      suggestion: describe(match),
      fixSafety: match.confidence === 'none' ? 'none' : 'review',
      params: { fields: fields.join(', '), label: opts.label, confidence: match.confidence },
      plan,
      alternativePlans: Object.keys(alternativePlans).length ? alternativePlans : undefined,
    };
  }
  if (opts.gridFallback && !isOnGrid(value, ctx.options.baseGrid)) {
    const lower = Math.floor(value / ctx.options.baseGrid) * ctx.options.baseGrid;
    const upper = lower + ctx.options.baseGrid;
    const nearest = value - lower < upper - value ? lower : upper;
    return {
      ruleId,
      node,
      slot: fields.join('+'),
      severity: 'warning',
      currentValue: px(value),
      suggestion: { kind: 'value', id: String(nearest), label: px(nearest), confidence: 'close' },
      fixSafety: 'none',
      params: { fields: fields.join(', '), label: opts.label, confidence: 'grid', grid: ctx.options.baseGrid },
    };
  }
  return null;
}

function isBound(node: SceneNode, field: NumericField): boolean {
  const bv = node.boundVariables as Record<string, unknown> | undefined;
  return Boolean(bv && bv[field]);
}

/** Regroupe des champs par valeur identique pour n'émettre qu'une issue par valeur. */
function groupByValue(node: SceneNode, fields: NumericField[]): Map<number, NumericField[]> {
  const out = new Map<number, NumericField[]>();
  const host = node as unknown as Record<string, unknown>;
  for (const f of fields) {
    const v = host[f];
    if (typeof v !== 'number' || v <= 0 || isBound(node, f)) continue;
    const key = Math.round(v * 100) / 100;
    out.set(key, [...(out.get(key) ?? []), f]);
  }
  return out;
}

export const spacingRules: Rule[] = [
  {
    id: 'spacing/off-scale-padding',
    types: LAYOUT_TYPES,
    check: (node, ctx) => {
      if (!hasAutoLayout(node)) return;
      const groups = groupByValue(node, ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']);
      const out: RawIssue[] = [];
      for (const [value, fields] of groups) {
        const issue = evaluateNumber('spacing/off-scale-padding', node, fields, value, ctx.spacingScale, ctx, {
          tolerance: ctx.options.spacingTolerance,
          gridFallback: true,
          label: 'padding',
        });
        if (issue) out.push(issue);
      }
      return out;
    },
  },
  {
    id: 'spacing/off-scale-gap',
    types: LAYOUT_TYPES,
    check: (node, ctx) => {
      if (!hasAutoLayout(node)) return;
      const frame = node as FrameNode;
      const fields: NumericField[] = [];
      if (frame.layoutMode !== 'GRID' && frame.primaryAxisAlignItems !== 'SPACE_BETWEEN') fields.push('itemSpacing');
      if (frame.layoutWrap === 'WRAP') fields.push('counterAxisSpacing');
      if (!fields.length) return;
      const groups = groupByValue(node, fields);
      const out: RawIssue[] = [];
      for (const [value, fs] of groups) {
        const issue = evaluateNumber('spacing/off-scale-gap', node, fs, value, ctx.spacingScale, ctx, {
          tolerance: ctx.options.spacingTolerance,
          gridFallback: true,
          label: 'gap',
        });
        if (issue) out.push(issue);
      }
      return out;
    },
  },
];

export const radiusRules: Rule[] = [
  {
    id: 'radius/not-tokenized',
    types: RADIUS_TYPES,
    check: (node, ctx) => {
      if (!ctx.radiusScale.length) return; // sans tokens de radius, rien à comparer
      if (!('cornerRadius' in node)) return;
      const bv = (node.boundVariables ?? {}) as Record<string, unknown>;
      if (bv.cornerRadius) return;
      const groups = groupByValue(node, ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']);
      const out: RawIssue[] = [];
      for (const [value, fields] of groups) {
        const issue = evaluateNumber('radius/not-tokenized', node, fields, value, ctx.radiusScale, ctx, {
          tolerance: 1,
          gridFallback: false,
          label: 'radius',
        });
        if (issue) out.push(issue);
      }
      return out;
    },
  },
];
