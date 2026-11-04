/// <reference types="@figma/plugin-typings" />
import { rgbToHex } from '../../shared/color';
import type { FixPlan } from '../fix/plans';
import type { RawIssue, ScanContext } from '../scan/context';
import { resolveSolidPaint } from '../scan/node-info';
import { matchColor, toSuggestion, type ColorUsage } from './match-color';
import type { Rule } from './types';

const PAINT_TYPES: NodeType[] = [
  'FRAME',
  'RECTANGLE',
  'ELLIPSE',
  'POLYGON',
  'STAR',
  'VECTOR',
  'LINE',
  'TEXT',
  'COMPONENT',
  'INSTANCE',
  'BOOLEAN_OPERATION',
];

function usageFor(node: SceneNode, prop: 'fills' | 'strokes'): ColorUsage {
  if (prop === 'strokes') return 'stroke';
  if (node.type === 'TEXT') return 'text-fill';
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') return 'frame-fill';
  return 'shape-fill';
}

async function checkPaints(node: SceneNode, prop: 'fills' | 'strokes', ctx: ScanContext, ruleId: string): Promise<RawIssue[]> {
  const host = node as SceneNode & MinimalFillsMixin & MinimalStrokesMixin;
  const paints = host[prop];
  if (!paints || paints === figma.mixed) return [];
  const styleId = prop === 'fills' ? host.fillStyleId : host.strokeStyleId;
  if (styleId && styleId !== figma.mixed) return []; // déjà stylé
  if (styleId === figma.mixed) return [];
  const issues: RawIssue[] = [];
  const list = paints as readonly Paint[];
  for (let i = 0; i < list.length; i++) {
    const paint = list[i];
    if (paint.type !== 'SOLID' || paint.visible === false || (paint.opacity ?? 1) === 0) continue;
    if (paint.boundVariables?.color) continue; // lié à une variable
    const { rgb, alpha } = await resolveSolidPaint(paint, node);
    const match = matchColor(rgb, alpha, ctx, usageFor(node, prop));
    const suggestion = toSuggestion(match);
    const hex = rgbToHex(rgb, alpha);
    const hasTokens = ctx.colors.length > 0 || ctx.paintStyles.length > 0;

    let severity: RawIssue['severity'] = 'warning';
    let fixSafety: RawIssue['fixSafety'] = 'none';
    if (match.confidence === 'exact') {
      severity = 'error';
      fixSafety = 'safe';
    } else if (match.confidence === 'close' || match.confidence === 'ambiguous') {
      fixSafety = 'review';
    } else if (!hasTokens) {
      severity = 'info';
    }

    let plan: FixPlan | undefined;
    const alternativePlans: Record<string, FixPlan> = {};
    if (match.token) plan = { kind: 'bind-paint-variable', nodeId: node.id, prop, index: i, variableId: match.token.id };
    else if (match.style) plan = { kind: 'apply-paint-style', nodeId: node.id, prop, styleId: match.style.id };
    for (const alt of match.alternatives) {
      if (alt.token) alternativePlans[`var:${alt.token.id}`] = { kind: 'bind-paint-variable', nodeId: node.id, prop, index: i, variableId: alt.token.id };
      else if (alt.style) alternativePlans[`style:${alt.style.id}`] = { kind: 'apply-paint-style', nodeId: node.id, prop, styleId: alt.style.id };
    }

    issues.push({
      ruleId,
      node,
      slot: `${prop}[${i}]`,
      severity,
      currentValue: hex,
      swatch: hex,
      suggestion,
      fixSafety,
      params: {
        prop,
        confidence: match.confidence,
        scopeMismatch: match.scopeMismatch ? 1 : 0,
        hasTokens: hasTokens ? 1 : 0,
      },
      plan,
      alternativePlans: Object.keys(alternativePlans).length ? alternativePlans : undefined,
    });
  }
  return issues;
}

export const colorRules: Rule[] = [
  {
    id: 'colors/hardcoded-fill',
    types: PAINT_TYPES,
    check: (node, ctx) => checkPaints(node, 'fills', ctx, 'colors/hardcoded-fill'),
  },
  {
    id: 'colors/hardcoded-stroke',
    types: PAINT_TYPES,
    check: (node, ctx) => checkPaints(node, 'strokes', ctx, 'colors/hardcoded-stroke'),
  },
];
