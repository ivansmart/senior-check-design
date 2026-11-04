/// <reference types="@figma/plugin-typings" />
import { isInteger, px } from '../../shared/scale';
import type { RawIssue } from '../scan/context';
import { hasAutoLayout } from '../scan/node-info';
import type { Rule } from './types';

const SIZE_TYPES: NodeType[] = ['FRAME', 'RECTANGLE', 'ELLIPSE', 'INSTANCE', 'COMPONENT', 'TEXT'];

function parentHasAutoLayout(node: SceneNode): boolean {
  const p = node.parent;
  return !!p && p.type !== 'PAGE' && hasAutoLayout(p as SceneNode) && (node as FrameNode).layoutPositioning !== 'ABSOLUTE';
}

/** Les enfants forment-ils une pile propre (ligne ou colonne, sans chevauchement) ? */
export function detectStack(children: { x: number; y: number; width: number; height: number }[]): 'row' | 'column' | null {
  if (children.length < 2) return null;
  const byX = [...children].sort((a, b) => a.x - b.x);
  let row = true;
  for (let i = 1; i < byX.length && row; i++) {
    const prev = byX[i - 1];
    const cur = byX[i];
    if (cur.x < prev.x + prev.width - 1) row = false; // chevauchement horizontal
    // Les plages verticales doivent se recouvrir (alignés sur une même ligne).
    if (cur.y > prev.y + prev.height - 1 || prev.y > cur.y + cur.height - 1) row = false;
  }
  if (row) return 'row';
  const byY = [...children].sort((a, b) => a.y - b.y);
  let column = true;
  for (let i = 1; i < byY.length && column; i++) {
    const prev = byY[i - 1];
    const cur = byY[i];
    if (cur.y < prev.y + prev.height - 1) column = false;
    if (cur.x > prev.x + prev.width - 1 || prev.x > cur.x + cur.width - 1) column = false;
  }
  return column ? 'column' : null;
}

export const handoffRules: Rule[] = [
  {
    id: 'handoff/fractional-size',
    types: SIZE_TYPES,
    check: (node) => {
      if (node.type === 'TEXT' && node.textAutoResize === 'WIDTH_AND_HEIGHT') return;
      if ('rotation' in node && Math.abs(node.rotation) > 0.01) return;
      let checkW = true;
      let checkH = true;
      if (parentHasAutoLayout(node) && 'layoutSizingHorizontal' in node) {
        checkW = node.layoutSizingHorizontal === 'FIXED';
        checkH = node.layoutSizingVertical === 'FIXED';
      }
      if (hasAutoLayout(node)) {
        // Un conteneur auto-layout en HUG a une taille dérivée : non pertinent.
        if (node.layoutSizingHorizontal !== 'FIXED') checkW = false;
        if (node.layoutSizingVertical !== 'FIXED') checkH = false;
      }
      if (node.type === 'TEXT' && node.textAutoResize === 'HEIGHT') checkH = false;
      const badW = checkW && !isInteger(node.width);
      const badH = checkH && !isInteger(node.height);
      if (!badW && !badH) return;
      return [
        {
          ruleId: 'handoff/fractional-size',
          node,
          currentValue: `${px(node.width).replace(' px', '')} × ${px(node.height)}`,
          suggestion: { kind: 'value', id: 'round', label: `${Math.round(node.width)} × ${Math.round(node.height)} px`, confidence: 'exact' },
          fixSafety: 'safe',
          params: { width: px(node.width), height: px(node.height) },
          plan: { kind: 'round-size', nodeId: node.id },
        },
      ];
    },
  },
  {
    id: 'handoff/fractional-position',
    types: SIZE_TYPES,
    check: (node) => {
      if (parentHasAutoLayout(node)) return; // position dérivée du layout
      if ('rotation' in node && Math.abs(node.rotation) > 0.01) return;
      if (isInteger(node.x) && isInteger(node.y)) return;
      return [
        {
          ruleId: 'handoff/fractional-position',
          node,
          currentValue: `x ${px(node.x).replace(' px', '')} · y ${px(node.y)}`,
          suggestion: { kind: 'value', id: 'round', label: `x ${Math.round(node.x)} · y ${Math.round(node.y)} px`, confidence: 'exact' },
          fixSafety: 'safe',
          params: { x: px(node.x), y: px(node.y) },
          plan: { kind: 'round-position', nodeId: node.id },
        },
      ];
    },
  },
  {
    id: 'handoff/stackable-without-autolayout',
    types: ['FRAME'],
    check: (node) => {
      const frame = node as FrameNode;
      if (frame.layoutMode !== 'NONE') return;
      const kids = frame.children.filter((c) => c.visible);
      if (kids.length < 2 || kids.length > 12) return;
      if (kids.some((k) => 'rotation' in k && Math.abs(k.rotation) > 0.01)) return;
      const stack = detectStack(kids.map((k) => ({ x: k.x, y: k.y, width: k.width, height: k.height })));
      if (!stack) return;
      return [
        {
          ruleId: 'handoff/stackable-without-autolayout',
          node,
          currentValue: `${kids.length} ${stack}`,
          suggestion: { kind: 'value', id: stack, label: stack === 'row' ? 'Auto layout →' : 'Auto layout ↓', confidence: 'close' },
          fixSafety: 'none',
          params: { count: kids.length, direction: stack },
        },
      ];
    },
  },
];
