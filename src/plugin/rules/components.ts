/// <reference types="@figma/plugin-typings" />
import { isDefaultName } from '../../shared/names';
import type { RawIssue } from '../scan/context';
import { ancestors } from '../scan/node-info';
import type { Rule } from './types';

const STYLE_FIELDS = new Set<string>([
  'fills',
  'strokes',
  'strokeWeight',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'itemSpacing',
  'counterAxisSpacing',
  'fontSize',
  'fontName',
  'lineHeight',
  'letterSpacing',
  'effects',
  'layoutMode',
  'opacity',
  'textStyleId',
  'fillStyleId',
  'strokeStyleId',
  'effectStyleId',
  'width',
  'height',
]);

const HEAVY_OVERRIDES_THRESHOLD = 4;

const normalizeComponentName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s*copy(\s*\d+)?$/i, '')
    .replace(/\s+\d+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

export const componentRules: Rule[] = [
  {
    id: 'components/detached-instance',
    types: ['FRAME'],
    check: (node, ctx) => {
      const frame = node as FrameNode;
      if (!frame.detachedInfo) return;
      // En mode Pro, la règle de rattachement prend le relais (même ligne, avec une proposition).
      if (ctx.activeRules.has('components/reattach-instance')) return;
      return [
        {
          ruleId: 'components/detached-instance',
          node,
          currentValue: frame.name,
          fixSafety: 'none',
          params: { origin: frame.detachedInfo.type },
        },
      ];
    },
  },
  {
    id: 'components/default-name',
    types: ['FRAME', 'GROUP', 'SECTION', 'COMPONENT', 'COMPONENT_SET'],
    check: (node, ctx) => {
      if (!isDefaultName(node.name)) return;
      // Les variantes d'un set portent des noms "Prop=Valeur" : non concernées.
      if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') return;
      // Un calque à l'intérieur d'un composant ou d'un set hérite d'un contexte nommé : on reste pertinent sur les conteneurs.
      void ctx;
      return [
        {
          ruleId: 'components/default-name',
          node,
          currentValue: node.name,
          fixSafety: 'none',
          params: { type: node.type.toLowerCase() },
        },
      ];
    },
  },
  {
    id: 'components/heavy-overrides',
    types: ['INSTANCE'],
    check: (node) => {
      const inst = node as InstanceNode;
      let count = 0;
      const fields = new Set<string>();
      for (const o of inst.overrides) {
        for (const f of o.overriddenFields) {
          if (STYLE_FIELDS.has(f)) {
            count++;
            fields.add(f);
          }
        }
      }
      if (count < HEAVY_OVERRIDES_THRESHOLD) return;
      return [
        {
          ruleId: 'components/heavy-overrides',
          node,
          currentValue: `${count}`,
          fixSafety: 'none',
          params: { count, fields: [...fields].slice(0, 6).join(', ') },
        },
      ];
    },
  },
  {
    id: 'components/no-description',
    types: ['COMPONENT', 'COMPONENT_SET'],
    check: (node, ctx) => {
      if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') return;
      if (ancestors(node, ctx).some((a) => a.type === 'COMPONENT' || a.type === 'COMPONENT_SET')) return;
      const desc = (node as ComponentNode | ComponentSetNode).description ?? '';
      if (desc.trim()) return;
      return [
        {
          ruleId: 'components/no-description',
          node,
          currentValue: node.name,
          fixSafety: 'none',
        },
      ];
    },
  },
  {
    id: 'components/duplicate-component',
    types: ['COMPONENT', 'COMPONENT_SET'],
    check: (node, ctx) => {
      if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') return;
      ctx.localComponents.push({ node: node as ComponentNode | ComponentSetNode, name: node.name });
    },
    finalize: (ctx) => {
      const groups = new Map<string, { node: ComponentNode | ComponentSetNode; name: string }[]>();
      for (const c of ctx.localComponents) {
        const key = normalizeComponentName(c.name);
        if (!key || isDefaultName(c.name)) continue;
        groups.set(key, [...(groups.get(key) ?? []), c]);
      }
      const out: RawIssue[] = [];
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        for (const c of list) {
          out.push({
            ruleId: 'components/duplicate-component',
            node: c.node,
            currentValue: c.name,
            fixSafety: 'none',
            params: { count: list.length, others: list.filter((o) => o !== c).map((o) => o.name).slice(0, 3).join(', ') },
          });
        }
      }
      return out;
    },
  },
];
