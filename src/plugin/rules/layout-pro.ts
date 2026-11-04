/// <reference types="@figma/plugin-typings" />
/** Espacement et layout (Pro) : rythme proche, dimensions fixes à remplacer par fill/hug, textes qui se chevauchent. */
import { isDefaultName, roleName } from '../../shared/names';
import type { RawIssue } from '../scan/context';
import { hasAutoLayout } from '../scan/node-info';
import type { Rule } from './types';

type AutoLayout = FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
type Child = SceneNode & AutoLayoutChildrenMixin & LayoutMixin;

const CHILD_TYPES: NodeType[] = ['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE', 'TEXT', 'GROUP', 'ELLIPSE', 'VECTOR', 'BOOLEAN_OPERATION'];
const EPS = 0.6;

function visibleChildren(parent: AutoLayout): Child[] {
  return parent.children.filter((c) => c.visible && 'layoutPositioning' in c && (c as Child).layoutPositioning !== 'ABSOLUTE') as Child[];
}

export const layoutProRules: Rule[] = [
  {
    id: 'spacing/rhythm-near-miss',
    types: ['FRAME', 'COMPONENT', 'INSTANCE'],
    check: (node, ctx) => {
      if (!hasAutoLayout(node) || node.layoutMode === 'NONE' || isDefaultName(node.name)) return;
      if (visibleChildren(node).length < 2) return;
      ctx.autoLayoutFrames.push({ node, role: roleName(node.name), mode: node.layoutMode, gap: node.itemSpacing });
    },
    finalize: (ctx) => {
      const groups = new Map<string, typeof ctx.autoLayoutFrames>();
      for (const f of ctx.autoLayoutFrames) {
        const key = `${f.role}|${f.mode}`;
        groups.set(key, [...(groups.get(key) ?? []), f]);
      }
      const out: RawIssue[] = [];
      for (const list of groups.values()) {
        if (list.length < 3) continue;
        const gaps = list.map((f) => f.gap);
        const min = Math.min(...gaps);
        const max = Math.max(...gaps);
        if (max === min || max - min > 6) continue;
        const counts = new Map<number, number>();
        for (const g of gaps) counts.set(g, (counts.get(g) ?? 0) + 1);
        const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
        for (const f of list) {
          if (f.gap === mode) continue;
          out.push({
            ruleId: 'spacing/rhythm-near-miss',
            node: f.node,
            currentValue: `${f.gap} px`,
            suggestion: { kind: 'value', id: String(mode), label: `${mode} px`, confidence: 'close' },
            fixSafety: 'review',
            params: { gap: f.gap, mode, role: f.node.name, count: list.length },
            plan: { kind: 'set-number', nodeId: f.node.id, field: 'itemSpacing', value: mode },
          });
        }
      }
      return out;
    },
  },
  {
    id: 'spacing/fixed-should-fill',
    types: CHILD_TYPES,
    check: (node) => {
      const parent = node.parent;
      if (!parent || !hasAutoLayout(parent as SceneNode) || (parent as AutoLayout).layoutMode === 'NONE') return;
      if (!('layoutSizingHorizontal' in node) || (node as Child).layoutPositioning === 'ABSOLUTE') return;
      const p = parent as AutoLayout;
      const child = node as Child;
      const out: RawIssue[] = [];
      if (p.layoutMode === 'VERTICAL' && child.layoutSizingHorizontal === 'FIXED') {
        const inner = p.width - p.paddingLeft - p.paddingRight;
        if (Math.abs(child.width - inner) < EPS && inner > 0) {
          out.push({
            ruleId: 'spacing/fixed-should-fill',
            node,
            slot: 'horizontal',
            currentValue: `${Math.round(child.width)} px`,
            suggestion: { kind: 'value', id: 'FILL', label: 'Fill', confidence: 'exact' },
            fixSafety: 'review',
            params: { axis: 'width', size: Math.round(child.width), parent: p.name },
            plan: { kind: 'set-layout-sizing', nodeId: node.id, axis: 'horizontal', value: 'FILL' },
          });
        }
      }
      if (p.layoutMode === 'HORIZONTAL' && child.layoutSizingVertical === 'FIXED') {
        const inner = p.height - p.paddingTop - p.paddingBottom;
        if (Math.abs(child.height - inner) < EPS && inner > 0 && visibleChildren(p).length > 1) {
          out.push({
            ruleId: 'spacing/fixed-should-fill',
            node,
            slot: 'vertical',
            currentValue: `${Math.round(child.height)} px`,
            suggestion: { kind: 'value', id: 'FILL', label: 'Fill', confidence: 'exact' },
            fixSafety: 'review',
            params: { axis: 'height', size: Math.round(child.height), parent: p.name },
            plan: { kind: 'set-layout-sizing', nodeId: node.id, axis: 'vertical', value: 'FILL' },
          });
        }
      }
      return out;
    },
  },
  {
    id: 'spacing/fixed-should-hug',
    types: ['FRAME', 'COMPONENT'],
    check: (node) => {
      if (!hasAutoLayout(node) || node.layoutMode === 'NONE' || node.layoutWrap === 'WRAP') return;
      const kids = visibleChildren(node);
      if (!kids.length) return;
      const horizontal = node.layoutMode === 'HORIZONTAL';
      const out: RawIssue[] = [];
      // Axe principal : somme des enfants + gaps + paddings.
      if (node.primaryAxisSizingMode === 'FIXED' && node.primaryAxisAlignItems !== 'SPACE_BETWEEN') {
        const fills = kids.some((k) => (horizontal ? k.layoutSizingHorizontal : k.layoutSizingVertical) === 'FILL');
        if (!fills) {
          const sum = kids.reduce((s, k) => s + (horizontal ? k.width : k.height), 0) + node.itemSpacing * (kids.length - 1);
          const hug = sum + (horizontal ? node.paddingLeft + node.paddingRight : node.paddingTop + node.paddingBottom);
          const actual = horizontal ? node.width : node.height;
          if (Math.abs(actual - hug) < EPS) {
            out.push({
              ruleId: 'spacing/fixed-should-hug',
              node,
              slot: 'primary',
              currentValue: `${Math.round(actual)} px`,
              suggestion: { kind: 'value', id: 'HUG', label: 'Hug', confidence: 'exact' },
              fixSafety: 'review',
              params: { axis: horizontal ? 'width' : 'height', size: Math.round(actual) },
              plan: { kind: 'set-axis-sizing', nodeId: node.id, axis: 'primary', value: 'AUTO' },
            });
          }
        }
      }
      // Axe secondaire : plus grand enfant + paddings.
      if (node.counterAxisSizingMode === 'FIXED') {
        const fills = kids.some((k) => (horizontal ? k.layoutSizingVertical : k.layoutSizingHorizontal) === 'FILL');
        if (!fills) {
          const max = Math.max(...kids.map((k) => (horizontal ? k.height : k.width)));
          const hug = max + (horizontal ? node.paddingTop + node.paddingBottom : node.paddingLeft + node.paddingRight);
          const actual = horizontal ? node.height : node.width;
          if (Math.abs(actual - hug) < EPS) {
            out.push({
              ruleId: 'spacing/fixed-should-hug',
              node,
              slot: 'counter',
              currentValue: `${Math.round(actual)} px`,
              suggestion: { kind: 'value', id: 'HUG', label: 'Hug', confidence: 'exact' },
              fixSafety: 'review',
              params: { axis: horizontal ? 'height' : 'width', size: Math.round(actual) },
              plan: { kind: 'set-axis-sizing', nodeId: node.id, axis: 'counter', value: 'AUTO' },
            });
          }
        }
      }
      return out;
    },
  },
  {
    id: 'spacing/text-overlap',
    types: ['TEXT'],
    check: (node) => {
      const parent = node.parent;
      if (!parent || parent.type === 'PAGE' || parent.type === 'DOCUMENT') return;
      if (hasAutoLayout(parent as SceneNode) && (parent as AutoLayout).layoutMode !== 'NONE') return;
      const box = node.absoluteBoundingBox;
      if (!box) return;
      const siblings = (parent as ChildrenMixin).children;
      const index = siblings.indexOf(node);
      const out: RawIssue[] = [];
      for (let i = 0; i < index; i++) {
        const other = siblings[i];
        if (other.type !== 'TEXT' || !other.visible) continue;
        const ob = other.absoluteBoundingBox;
        if (!ob) continue;
        const dx = Math.min(box.x + box.width, ob.x + ob.width) - Math.max(box.x, ob.x);
        const dy = Math.min(box.y + box.height, ob.y + ob.height) - Math.max(box.y, ob.y);
        if (dx > 2 && dy > 2) {
          out.push({
            ruleId: 'spacing/text-overlap',
            node,
            slot: other.id,
            currentValue: `${Math.round(dx)} × ${Math.round(dy)} px`,
            fixSafety: 'none',
            params: { other: other.name, dx: Math.round(dx), dy: Math.round(dy) },
          });
        }
      }
      return out;
    },
  },
];
