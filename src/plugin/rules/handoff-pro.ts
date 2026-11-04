/// <reference types="@figma/plugin-typings" />
/** Handoff (Pro) : motifs répétés à composantiser, recadrages d'image manuels. */
import { roleName } from '../../shared/names';
import type { RawIssue } from '../scan/context';
import type { Rule } from './types';

const MIN_REPEATS = 3;

function signature(node: SceneNode, depth: number): string {
  const base = `${node.type}:${roleName(node.name)}:${Math.round(node.width / 4)}x${Math.round(node.height / 4)}`;
  if (depth === 0 || !('children' in node)) return base;
  const kids = (node as ChildrenMixin).children.slice(0, 12).map((c) => signature(c, depth - 1));
  return `${base}[${kids.join(',')}]`;
}

export const handoffProRules: Rule[] = [
  {
    id: 'handoff/repeated-pattern',
    types: ['FRAME', 'GROUP', 'SECTION', 'COMPONENT'],
    check: (node) => {
      const children = (node as ChildrenMixin).children.filter((c) => c.visible && (c.type === 'FRAME' || c.type === 'GROUP') && 'children' in c && (c as ChildrenMixin).children.length >= 2);
      if (children.length < MIN_REPEATS) return;
      const groups = new Map<string, SceneNode[]>();
      for (const c of children) {
        const sig = signature(c, 2);
        groups.set(sig, [...(groups.get(sig) ?? []), c]);
      }
      const out: RawIssue[] = [];
      for (const list of groups.values()) {
        if (list.length < MIN_REPEATS) continue;
        out.push({
          ruleId: 'handoff/repeated-pattern',
          node: list[0],
          currentValue: `${list.length} × ${list[0].name}`,
          fixSafety: 'none',
          params: { count: list.length, name: list[0].name, parent: node.name },
        });
      }
      return out;
    },
  },
  {
    id: 'handoff/image-crop',
    types: ['RECTANGLE', 'FRAME', 'ELLIPSE', 'POLYGON', 'INSTANCE', 'COMPONENT'],
    check: (node) => {
      const fills = (node as GeometryMixin).fills;
      if (fills === figma.mixed) return;
      const cropped = fills.some((p) => p.type === 'IMAGE' && p.visible !== false && p.scaleMode === 'CROP');
      if (!cropped) return;
      return [{ ruleId: 'handoff/image-crop', node, currentValue: 'Crop', fixSafety: 'none', params: { name: node.name } }];
    },
  },
];
