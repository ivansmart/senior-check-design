/// <reference types="@figma/plugin-typings" />
/** Composants (Pro) : obsolètes encore utilisés, variantes orphelines, imbrications inutiles, documentation et statut. */
import { DEPRECATED_RE, STATUS_RE } from '../../shared/names';
import type { RawIssue } from '../scan/context';
import { ancestors } from '../scan/node-info';
import type { Rule } from './types';

/** getInstancesAsync parcourt tout le document : borné en nombre et en temps, et seulement en périmètre fichier. */
const MAX_ORPHAN_LOOKUPS = 60;
const ORPHAN_BUDGET_MS = 4000;

function isTopLevelComponent(node: SceneNode): boolean {
  if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') return false;
  return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
}

const hasVisible = (paints: readonly Paint[] | typeof figma.mixed) => paints !== figma.mixed && paints.some((p) => p.visible !== false && (p.opacity ?? 1) > 0);

export const componentProRules: Rule[] = [
  {
    id: 'components/deprecated-in-use',
    types: ['INSTANCE'],
    check: async (node) => {
      const inst = node as InstanceNode;
      let main: ComponentNode | null = null;
      try {
        main = await inst.getMainComponentAsync();
      } catch {
        return;
      }
      if (!main) return;
      const set = main.parent?.type === 'COMPONENT_SET' ? main.parent : null;
      const hay = `${main.name} ${main.description ?? ''} ${set ? `${set.name} ${set.description ?? ''}` : ''}`;
      if (!DEPRECATED_RE.test(hay)) return;
      return [{ ruleId: 'components/deprecated-in-use', node, currentValue: set ? set.name : main.name, fixSafety: 'none', params: { component: set ? set.name : main.name } }];
    },
  },
  {
    id: 'components/orphan-variant',
    finalize: async (ctx) => {
      if (ctx.scope !== 'file') return; // les pages sont déjà chargées ; ailleurs, la recherche d'instances chargerait tout le fichier
      const out: RawIssue[] = [];
      const started = Date.now();
      let lookups = 0;
      for (const s of ctx.componentSets) {
        if (s.node.remote) continue;
        for (const child of s.node.children) {
          if (child.type !== 'COMPONENT') continue;
          if (++lookups > MAX_ORPHAN_LOOKUPS || Date.now() - started > ORPHAN_BUDGET_MS) {
            ctx.warnings.push('rule-partial:components/orphan-variant');
            return out;
          }
          try {
            const instances = await child.getInstancesAsync();
            if (instances.length) continue;
          } catch {
            continue;
          }
          out.push({ ruleId: 'components/orphan-variant', node: child, currentValue: child.name, fixSafety: 'none', params: { variant: child.name, component: s.name } });
        }
      }
      return out;
    },
  },
  {
    id: 'components/useless-nesting',
    types: ['GROUP', 'FRAME'],
    check: (node) => {
      if (node.parent?.type === 'PAGE') return;
      const children = (node as GroupNode | FrameNode).children.filter((c) => c.visible);
      if (children.length !== 1) return;
      const only = children[0];
      if (node.type === 'FRAME') {
        const frame = node as FrameNode;
        if (frame.layoutMode !== 'NONE' || frame.clipsContent || frame.detachedInfo || frame.reactions.length) return;
        if (hasVisible(frame.fills) || hasVisible(frame.strokes) || frame.effects.some((e) => e.visible)) return;
        if (Math.abs(only.width - frame.width) > 1 || Math.abs(only.height - frame.height) > 1 || Math.abs(only.x) > 1 || Math.abs(only.y) > 1) return;
      }
      return [{ ruleId: 'components/useless-nesting', node, currentValue: node.name, fixSafety: 'none', params: { type: node.type === 'GROUP' ? 'group' : 'frame', child: only.name } }];
    },
  },
  {
    id: 'components/no-doc-link',
    types: ['COMPONENT', 'COMPONENT_SET'],
    check: (node, ctx) => {
      if (!isTopLevelComponent(node) || ancestors(node, ctx).some((a) => a.type === 'COMPONENT' || a.type === 'COMPONENT_SET')) return;
      const comp = node as ComponentNode | ComponentSetNode;
      if (comp.documentationLinks.length || /https?:\/\//i.test(comp.description ?? '')) {
        ctx.docLinkSeen = true;
        return;
      }
      ctx.componentsForDocs.push(comp);
    },
    finalize: (ctx) => {
      if (!ctx.docLinkSeen) return; // le fichier ne documente pas ses composants par lien : on n'exige rien
      return ctx.componentsForDocs.map<RawIssue>((c) => ({ ruleId: 'components/no-doc-link', node: c, currentValue: c.name, fixSafety: 'none', params: { component: c.name } }));
    },
  },
  {
    id: 'components/no-status',
    types: ['COMPONENT', 'COMPONENT_SET'],
    check: (node, ctx) => {
      if (!isTopLevelComponent(node) || ancestors(node, ctx).some((a) => a.type === 'COMPONENT' || a.type === 'COMPONENT_SET')) return;
      if (!ctx.localComponents.some((c) => c.node.id === node.id)) ctx.localComponents.push({ node: node as ComponentNode | ComponentSetNode, name: node.name });
    },
    finalize: (ctx) => {
      const all = ctx.localComponents;
      if (all.length < 3) return;
      const withStatus = all.filter((c) => STATUS_RE.test(`${c.name} ${c.node.description ?? ''}`));
      if (withStatus.length / all.length < 0.3) return; // pas de convention de statut dans ce fichier
      const sample = STATUS_RE.exec(`${withStatus[0].name} ${withStatus[0].node.description ?? ''}`)?.[0] ?? '';
      return all
        .filter((c) => !withStatus.includes(c))
        .map<RawIssue>((c) => ({ ruleId: 'components/no-status', node: c.node, currentValue: c.name, fixSafety: 'none', params: { component: c.name, example: sample } }));
    },
  },
];
