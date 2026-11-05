/// <reference types="@figma/plugin-typings" />
/** Composants (Pro) : rattachement des instances détachées, obsolètes encore utilisés, variantes orphelines, imbrications inutiles, documentation et statut. */
import { DEPRECATED_RE, STATUS_RE } from '../../shared/names';
import { forcedCost, matchBest, summarizeOverrides, type MatchResult } from '../../shared/reattach';
import { MAX_FORCED_EXTRAS, newBudget, reasonDetail, reattachPlan, toTree, variantLabel } from '../reattach-live';
import { addComponent } from '../scan/component-index';
import type { RawIssue, ScanContext } from '../scan/context';
import { ancestors, pageOf } from '../scan/node-info';
import type { Rule } from './types';

/** Variantes sœurs comparées au détaché (un jeu plus grand est tronqué dans l'ordre du jeu). */
const MAX_VARIANT_CANDIDATES = 40;

async function originComponent(info: DetachedInfo): Promise<ComponentNode | null> {
  try {
    if (info.type === 'local') {
      const node = await figma.getNodeByIdAsync(info.componentId);
      return node && node.type === 'COMPONENT' && !node.removed ? node : null;
    }
    return await figma.importComponentByKeyAsync(info.componentKey);
  } catch {
    return null;
  }
}

function manualReattach(frame: FrameNode, reason: string, detail = ''): RawIssue {
  return { ruleId: 'components/reattach-instance', node: frame, currentValue: frame.name, fixSafety: 'none', params: { confidence: 'none', reason, detail, origin: frame.detachedInfo?.type ?? 'local' } };
}

async function checkReattach(frame: FrameNode, ctx: ScanContext): Promise<RawIssue[] | void> {
  const info = frame.detachedInfo;
  if (!info) return;
  if (ancestors(frame, ctx).some((a) => a.type === 'INSTANCE')) return [manualReattach(frame, 'inside-instance')];
  const origin = await originComponent(info);
  if (!origin) {
    // Origine introuvable : la règle de ressemblance pourra encore proposer un composant local.
    ctx.reattachMissingOrigin.add(frame.id);
    return [manualReattach(frame, 'component-missing')];
  }
  // L'origine (et ses variantes sœurs) rejoint l'index des candidats : utile aux autres cadres, y compris pour une librairie.
  addComponent(ctx, origin, origin.remote ? 'library' : pageOf(origin)?.id === figma.currentPage.id ? 'local' : 'otherPages');
  const set = origin.parent?.type === 'COMPONENT_SET' ? origin.parent : null;
  const candidates: ComponentNode[] = [origin, ...(set ? set.children.filter((c): c is ComponentNode => c.type === 'COMPONENT' && c.id !== origin.id) : [])].slice(0, MAX_VARIANT_CANDIDATES);
  const detachedTree = await toTree(frame, 0, newBudget());
  const matches: { comp: ComponentNode; result: MatchResult }[] = [];
  const all: { comp: ComponentNode; result: MatchResult }[] = [];
  for (const comp of candidates) {
    // Par structure quand elle correspond ; sinon par contenu (feuilles en ordre de lecture) si c'est plus fidèle.
    const result = matchBest(detachedTree, await toTree(comp, 0, newBudget()));
    all.push({ comp, result });
    if (result.ok) matches.push({ comp, result });
  }
  if (!matches.length) {
    // Structure divergente : rattachement « forcé » possible avec consentement, rendu conservé
    // (overrides reproductibles + calques ajoutés gardés au-dessus de l'instance dans un cadre).
    all.sort((a, b) => forcedCost(a.result) - forcedCost(b.result) || (a.comp === origin ? -1 : 0) - (b.comp === origin ? -1 : 0));
    const best = all[0];
    if (!best || best.result.extras.length > MAX_FORCED_EXTRAS) return [manualReattach(frame, 'structure', reasonDetail(best?.result.reasons ?? []))];
    const sum = summarizeOverrides(best.result);
    const label = variantLabel(best.comp);
    return [
      {
        ruleId: 'components/reattach-instance',
        node: frame,
        currentValue: frame.name,
        suggestion: { kind: 'component', id: best.comp.id, label, confidence: 'ambiguous', source: best.comp.remote ? 'Library' : 'Local' },
        fixSafety: 'review',
        params: {
          confidence: 'forced',
          component: label,
          detail: reasonDetail(best.result.reasons),
          extras: best.result.extras.length,
          hidden: best.result.stats.hidden,
          match: best.result.mode ?? 'tree',
          total: best.result.overrides.length,
          texts: sum.texts,
          visibility: sum.visibility,
          paints: sum.paints,
          origin: info.type,
        },
        plan: reattachPlan(frame, best.comp, best.result, true),
      },
    ];
  }
  // La variante qui demande le moins d'overrides ; à égalité, celle d'origine.
  matches.sort((a, b) => a.result.overrides.length - b.result.overrides.length || (a.comp === origin ? -1 : 0) - (b.comp === origin ? -1 : 0));
  const best = matches[0];
  const others = matches.slice(1, 4);
  const sum = summarizeOverrides(best.result);
  const exact = best.result.overrides.length === 0;
  const label = variantLabel(best.comp);
  return [
    {
      ruleId: 'components/reattach-instance',
      node: frame,
      currentValue: frame.name,
      suggestion: {
        kind: 'component',
        id: best.comp.id,
        label,
        confidence: exact ? 'exact' : 'close',
        source: best.comp.remote ? 'Library' : 'Local',
        alternatives: others.length ? others.map((o) => ({ id: `comp:${o.comp.id}`, label: variantLabel(o.comp), value: `${o.result.overrides.length}` })) : undefined,
      },
      fixSafety: exact ? 'safe' : 'review',
      params: { confidence: exact ? 'exact' : 'close', component: label, total: best.result.overrides.length, texts: sum.texts, visibility: sum.visibility, paints: sum.paints, other: sum.other, origin: info.type },
      plan: reattachPlan(frame, best.comp, best.result),
      alternativePlans: Object.fromEntries(others.map((o) => [`comp:${o.comp.id}`, reattachPlan(frame, o.comp, o.result)])),
    },
  ];
}

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
    id: 'components/reattach-instance',
    types: ['FRAME'],
    check: (node, ctx) => checkReattach(node as FrameNode, ctx),
  },
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
