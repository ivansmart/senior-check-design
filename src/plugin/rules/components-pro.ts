/// <reference types="@figma/plugin-typings" />
/** Composants (Pro) : rattachement des instances détachées, obsolètes encore utilisés, variantes orphelines, imbrications inutiles, documentation et statut. */
import { DEPRECATED_RE, STATUS_RE } from '../../shared/names';
import { forcedCost, matchBest, summarizeOverrides, type MatchResult } from '../../shared/reattach';
import { MAX_FORCED_EXTRAS, componentTree, importComponentCached, newBudget, reasonDetail, reattachPlan, toTree, variantLabel } from '../reattach-live';
import { addComponent, buildComponentIndex, noteInstance } from '../scan/component-index';
import { yieldToHost, type RawIssue, type ScanContext } from '../scan/context';
import { ancestors, pageOf } from '../scan/node-info';
import type { Rule } from './types';

/** Variantes sœurs comparées au détaché (un jeu plus grand est tronqué dans l'ordre du jeu). */
const MAX_VARIANT_CANDIDATES = 40;
/** Temps total consacré aux rattachements d'une analyse (imports de librairie compris). */
const REATTACH_BUDGET_MS = 8000;

interface Origin {
  comp: ComponentNode | null;
  /** Message de l'API quand aucun composant n'a pu être retrouvé. */
  error?: string;
}

const firstVariant = (set: ComponentSetNode): ComponentNode | null => set.defaultVariant ?? set.children.find((c): c is ComponentNode => c.type === 'COMPONENT') ?? null;

/** Composants de librairie déjà matérialisés dans le fichier par une instance vivante, par clé de publication. */
function liveLibraryComponents(ctx: ScanContext): Map<string, ComponentNode> {
  const byKey = new Map<string, ComponentNode>();
  for (const { comp } of ctx.componentPool.values()) if (comp.remote && !comp.removed && comp.key) byKey.set(comp.key, comp);
  return byKey;
}

/**
 * Composant d'origine d'un détaché. Local : par identifiant. Librairie : d'abord un composant déjà présent dans le
 * fichier grâce à une instance vivante (aucun import), puis l'import par clé de composant, puis par clé de jeu de
 * variantes (la clé conservée par un détachement peut désigner le jeu). Le message de la dernière erreur est gardé.
 */
async function resolveOrigin(info: DetachedInfo, ctx: ScanContext, live: Map<string, ComponentNode>): Promise<Origin> {
  if (info.type === 'local') {
    let node: BaseNode | null = null;
    try {
      node = await figma.getNodeByIdAsync(info.componentId);
    } catch {
      node = null;
    }
    if (node && node.type === 'COMPONENT' && !node.removed) return { comp: node };
    if (node && node.type === 'COMPONENT_SET' && !node.removed) return { comp: firstVariant(node) };
    return { comp: null };
  }
  const present = live.get(info.componentKey);
  if (present) return { comp: present };
  const imported = await importComponentCached(ctx, info.componentKey);
  if (imported) return { comp: imported };
  let error = ctx.importErrors.get(info.componentKey);
  try {
    const set = await figma.importComponentSetByKeyAsync(info.componentKey);
    const variant = firstVariant(set);
    if (variant) return { comp: variant };
  } catch (e) {
    error = error ?? (e instanceof Error ? e.message : String(e));
  }
  return { comp: null, error };
}

function manualReattach(frame: FrameNode, reason: string, detail = ''): RawIssue {
  return { ruleId: 'components/reattach-instance', node: frame, currentValue: frame.name, fixSafety: 'none', params: { confidence: 'none', reason, detail, origin: frame.detachedInfo?.type ?? 'local' } };
}

/** Nom comparable d'un composant ou d'un cadre : casse, espaces et ponctuation ignorées. */
const nameKey = (s: string) => s.toLowerCase().replace(/[\s_\-./:,;()[\]{}'"]+/g, '');
/** Plafond des candidats de même nom (un jeu est déjà échantillonné dans l'index). */
const MAX_NAME_CANDIDATES = 80;

/**
 * Composants de l'index portant le nom du détaché (nom du jeu de variantes ou du composant) : un détaché dont la
 * librairie est inaccessible retrouve ainsi l'équivalent connu du fichier. Les composants locaux passent d'abord.
 */
function sameNameCandidates(ctx: ScanContext, frame: FrameNode): ComponentNode[] {
  const wanted = nameKey(frame.name);
  if (!wanted) return [];
  const out: ComponentNode[] = [];
  for (const { comp } of ctx.componentPool.values()) {
    if (comp.removed) continue;
    const set = comp.parent?.type === 'COMPONENT_SET' ? comp.parent : null;
    if (nameKey(set ? set.name : comp.name) === wanted || (set !== null && nameKey(comp.name) === wanted)) out.push(comp);
  }
  return out.sort((a, b) => Number(a.remote) - Number(b.remote)).slice(0, MAX_NAME_CANDIDATES);
}

interface Scored {
  comp: ComponentNode;
  result: MatchResult;
}

/**
 * Proposition parmi des candidats : la variante qui demande le moins d'overrides quand la structure correspond ;
 * sinon un rattachement « forcé » (consentement) tant que les calques ajoutés restent peu nombreux. Par le nom
 * (`via`), un détaché sans correspondance forcée possible revient à la règle de ressemblance plutôt qu'en manuel.
 */
async function proposeReattach(frame: FrameNode, info: DetachedInfo, ctx: ScanContext, candidates: ComponentNode[], origin: ComponentNode | null, via?: 'name'): Promise<RawIssue | null> {
  const detachedTree = await toTree(frame, 0, newBudget());
  const matches: Scored[] = [];
  const all: Scored[] = [];
  for (let i = 0; i < candidates.length; i++) {
    if (i % 20 === 19) await yieldToHost();
    const comp = candidates[i];
    // Par structure quand elle correspond ; sinon par contenu (feuilles en ordre de lecture) si c'est plus fidèle.
    const result = matchBest(detachedTree, await componentTree(ctx, comp));
    all.push({ comp, result });
    if (result.ok) matches.push({ comp, result });
  }
  const extra: Record<string, string> = via ? { via } : {};
  if (!matches.length) {
    // Structure divergente : rattachement « forcé » possible avec consentement, rendu conservé
    // (overrides reproductibles + calques ajoutés gardés au-dessus de l'instance dans un cadre).
    all.sort((a, b) => forcedCost(a.result) - forcedCost(b.result) || (a.comp === origin ? -1 : 0) - (b.comp === origin ? -1 : 0));
    const best = all[0];
    if (!best || best.result.extras.length > MAX_FORCED_EXTRAS) return via ? null : manualReattach(frame, 'structure', reasonDetail(best?.result.reasons ?? []));
    const sum = summarizeOverrides(best.result);
    const label = variantLabel(best.comp);
    return {
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
        ...extra,
      },
      plan: reattachPlan(frame, best.comp, best.result, true),
    };
  }
  // La variante qui demande le moins d'overrides ; à égalité, celle d'origine.
  matches.sort((a, b) => a.result.overrides.length - b.result.overrides.length || (a.comp === origin ? -1 : 0) - (b.comp === origin ? -1 : 0));
  const best = matches[0];
  const others = matches.slice(1, 4);
  const sum = summarizeOverrides(best.result);
  const exact = best.result.overrides.length === 0;
  const label = variantLabel(best.comp);
  return {
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
    params: { confidence: exact ? 'exact' : 'close', component: label, total: best.result.overrides.length, texts: sum.texts, visibility: sum.visibility, paints: sum.paints, other: sum.other, origin: info.type, ...extra },
    plan: reattachPlan(frame, best.comp, best.result),
    alternativePlans: Object.fromEntries(others.map((o) => [`comp:${o.comp.id}`, reattachPlan(frame, o.comp, o.result)])),
  };
}

async function checkReattach(frame: FrameNode, ctx: ScanContext, live: Map<string, ComponentNode>): Promise<RawIssue[] | void> {
  const info = frame.detachedInfo;
  if (!info) return;
  const resolved = await resolveOrigin(info, ctx, live);
  const origin = resolved.comp;
  if (!origin) {
    // Origine introuvable (librairie non publiée, retirée ou sans accès) : l'équivalent de même nom connu du fichier
    // est proposé s'il reproduit fidèlement le détaché ; sinon la règle de ressemblance pourra encore proposer un composant.
    const byName = sameNameCandidates(ctx, frame);
    const proposal = byName.length ? await proposeReattach(frame, info, ctx, byName, null, 'name') : null;
    if (proposal) return [proposal];
    ctx.reattachMissingOrigin.add(frame.id);
    const error = resolved.error ?? '';
    if (/not found/i.test(error)) return [manualReattach(frame, byName.length ? 'component-unpublished-diverged' : 'component-unpublished', byName.length ? variantLabel(byName[0]) : error)];
    return [manualReattach(frame, error ? 'component-missing-detail' : 'component-missing', error)];
  }
  // L'origine (et ses variantes sœurs) rejoint l'index des candidats : utile aux autres cadres, y compris pour une librairie.
  addComponent(ctx, origin, origin.remote ? 'library' : pageOf(origin)?.id === figma.currentPage.id ? 'local' : 'otherPages');
  const set = origin.parent?.type === 'COMPONENT_SET' ? origin.parent : null;
  const candidates: ComponentNode[] = [origin, ...(set ? set.children.filter((c): c is ComponentNode => c.type === 'COMPONENT' && c.id !== origin.id) : [])].slice(0, MAX_VARIANT_CANDIDATES);
  const proposal = await proposeReattach(frame, info, ctx, candidates, origin);
  return proposal ? [proposal] : undefined;
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
    types: ['FRAME', 'COMPONENT', 'INSTANCE'],
    // Le parcours recense les détachés et alimente l'index des candidats (composants rencontrés, composants de librairie
    // des instances) ; le rattachement se décide en phase finale, une fois l'index complété (autres pages), hors du
    // budget de temps par calque.
    check: async (node, ctx) => {
      if (node.type === 'COMPONENT') {
        addComponent(ctx, node, 'local');
        return;
      }
      if (node.type === 'INSTANCE') {
        await noteInstance(ctx, node);
        return;
      }
      const frame = node as FrameNode;
      if (!frame.detachedInfo) return;
      if (ancestors(frame, ctx).some((a) => a.type === 'INSTANCE')) return [manualReattach(frame, 'inside-instance')];
      ctx.detachedFrames.push(frame);
    },
    finalize: async (ctx) => {
      const frames = ctx.detachedFrames.filter((f) => !f.removed);
      if (!frames.length) return;
      await buildComponentIndex(ctx);
      const live = liveLibraryComponents(ctx);
      const out: RawIssue[] = [];
      const t0 = Date.now();
      for (let i = 0; i < frames.length; i++) {
        if (Date.now() - t0 > REATTACH_BUDGET_MS || ctx.isCancelled()) {
          ctx.warnings.push('rule-partial:components/reattach-instance');
          break;
        }
        if (i % 5 === 4) await yieldToHost();
        try {
          const issues = await checkReattach(frames[i], ctx, live);
          if (issues) out.push(...issues);
        } catch {
          ctx.warnings.push('rule:components/reattach-instance');
        }
      }
      return out;
    },
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
