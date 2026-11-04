/// <reference types="@figma/plugin-typings" />
import { RULE_BY_ID } from '../../shared/rules-catalog';
import type { Category, Issue, ScanOptions, ScanProgress, ScanResult, ScanScope } from '../../shared/types';
import type { FixPlan } from '../fix/plans';
import type { Rule } from '../rules/types';
import { createContext, indexPaintStyle, indexTextStyle, indexTokens, rebuildScales, yieldToHost, type RawIssue, type ScanContext } from './context';
import { isEffectivelyHidden, isEffectivelyLocked, isInsideInstance, pageOf, pathOf } from './node-info';

export interface ScanRequest {
  scope: ScanScope;
  options: ScanOptions;
  activeRules: Set<string>;
  ignoredIssueIds: Set<string>;
  /** Jeu de règles disponibles (ALL_RULES en production ; sous-ensemble pour les bundles de test). */
  rules: Rule[];
}

export interface IssuePlans {
  plan?: FixPlan;
  alternativePlans?: Record<string, FixPlan>;
}

export interface EngineOutput {
  result: ScanResult;
  plans: Map<string, IssuePlans>;
  cancelled: boolean;
}

/** Durée maximale de travail continu avant de rendre la main à Figma. */
const YIELD_EVERY_MS = 32;
/** Temps cumulé au-delà duquel une règle est suspendue pour l'analyse en cours. */
const RULE_TIME_BUDGET_MS = 6000;
const MAX_LEARNED_STYLES = 300;
const INTERACTIVE_KINDS = new Set(['button', 'icon-button', 'link', 'input', 'select', 'checkbox', 'radio', 'toggle', 'chip', 'tab', 'search']);

function scopeLabel(scope: ScanScope, roots: readonly BaseNode[]): string {
  if (scope === 'file') return figma.root.name;
  if (scope === 'page') return figma.currentPage.name;
  const names = roots.slice(0, 3).map((r) => r.name);
  return roots.length > 3 ? `${names.join(', ')} +${roots.length - 3}` : names.join(', ');
}

async function resolveRoots(scope: ScanScope): Promise<{ roots: BaseNode[]; pages: number }> {
  if (scope === 'file') {
    await figma.loadAllPagesAsync();
    return { roots: [...figma.root.children], pages: figma.root.children.length };
  }
  if (scope === 'selection' && figma.currentPage.selection.length) {
    return { roots: [...figma.currentPage.selection], pages: 1 };
  }
  return { roots: [figma.currentPage], pages: 1 };
}

function collectTypes(rules: Rule[]): NodeType[] {
  const set = new Set<NodeType>();
  for (const r of rules) for (const t of r.types ?? []) set.add(t);
  return [...set];
}

async function collectNodes(roots: BaseNode[], types: NodeType[], ctx: ScanContext): Promise<SceneNode[]> {
  const out: SceneNode[] = [];
  const seen = new Set<string>();
  const typeSet = new Set<string>(types);
  for (const root of roots) {
    if (ctx.isCancelled()) break;
    if (root.type !== 'PAGE' && typeSet.has(root.type) && !seen.has(root.id)) {
      seen.add(root.id);
      out.push(root as SceneNode);
    }
    if ('findAllWithCriteria' in root) {
      const found = (root as ChildrenMixin).findAllWithCriteria({ types: types as never }) as SceneNode[];
      for (const n of found) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        out.push(n);
      }
    }
    ctx.reportProgress({ phase: 'collecting', scanned: 0, total: out.length });
    await yieldToHost();
  }
  return out;
}

/** Apprend les styles distants déjà utilisés dans le fichier (librairies), pour pouvoir les suggérer. */
async function learnRemoteStyles(nodes: SceneNode[], ctx: ScanContext) {
  const textIds = new Set<string>();
  const paintIds = new Set<string>();
  for (const n of nodes) {
    if (n.type === 'TEXT' && typeof n.textStyleId === 'string' && n.textStyleId) textIds.add(n.textStyleId);
    if ('fillStyleId' in n && typeof n.fillStyleId === 'string' && n.fillStyleId) paintIds.add(n.fillStyleId);
    if (textIds.size + paintIds.size >= MAX_LEARNED_STYLES) break;
  }
  const knownText = new Set(ctx.textStyles.map((s) => s.id));
  const knownPaint = new Set(ctx.paintStyles.map((s) => s.id));
  const pending = [...[...textIds].filter((id) => !knownText.has(id)), ...[...paintIds].filter((id) => !knownPaint.has(id))];
  // Lectures par lots parallèles : un style distant peut nécessiter un aller-retour réseau.
  for (let i = 0; i < pending.length; i += 40) {
    const styles = await Promise.all(pending.slice(i, i + 40).map((id) => figma.getStyleByIdAsync(id).catch(() => null)));
    for (const s of styles) {
      if (!s) continue;
      if (s.type === 'TEXT') indexTextStyle(ctx, s);
      else if (s.type === 'PAINT') await indexPaintStyle(ctx, s);
    }
    await yieldToHost();
  }
  rebuildScales(ctx);
}

function toIssue(raw: RawIssue, ctx: ScanContext, ignored: Set<string>): Issue {
  const meta = RULE_BY_ID[raw.ruleId];
  const target = raw.virtual
    ? { id: raw.virtual.id, name: raw.virtual.name, type: raw.virtual.type, path: raw.virtual.path, pageId: '' }
    : { id: raw.node!.id, name: raw.node!.name, type: raw.node!.type, path: pathOf(raw.node!, ctx), pageId: pageOf(raw.node!)?.id ?? '' };
  const id = `${raw.ruleId}::${target.id}::${raw.slot ?? ''}`;
  const severity = raw.severity ?? meta.severity;
  return {
    id,
    ruleId: raw.ruleId,
    category: meta.category,
    severity,
    nodeId: target.id,
    nodeName: target.name,
    nodeType: target.type,
    nodePath: target.path,
    pageId: target.pageId,
    currentValue: raw.currentValue,
    swatch: raw.swatch,
    suggestion: raw.suggestion,
    fixSafety: raw.fixSafety,
    params: raw.params,
    status: ignored.has(id) ? 'ignored' : 'open',
    groupKey: `${raw.ruleId}|${raw.currentValue}|${raw.suggestion?.id ?? ''}`,
  };
}

export async function runScan(
  req: ScanRequest,
  report: (p: ScanProgress) => void,
  isCancelled: () => boolean,
): Promise<EngineOutput> {
  const started = Date.now();
  const progress: ScanProgress = { phase: 'indexing', scanned: 0, total: 0, found: {} };
  const emit = (p: Partial<ScanProgress>) => {
    Object.assign(progress, p);
    progress.found = ctx.found;
    report({ ...progress, found: { ...ctx.found } });
  };
  const ctx = createContext(req.options, req.activeRules, emit, isCancelled);
  ctx.scope = req.scope;
  const plans = new Map<string, IssuePlans>();
  const issues: Issue[] = [];
  const seenIds = new Set<string>();

  const push = (raw: RawIssue) => {
    if (!req.activeRules.has(raw.ruleId)) return;
    const issue = toIssue(raw, ctx, req.ignoredIssueIds);
    if (seenIds.has(issue.id)) return;
    seenIds.add(issue.id);
    issues.push(issue);
    if (issue.status === 'open') ctx.found[issue.category] = (ctx.found[issue.category] ?? 0) + 1;
    if (raw.plan || raw.alternativePlans) plans.set(issue.id, { plan: raw.plan, alternativePlans: raw.alternativePlans });
  };

  const allRules = req.rules;
  const rules = allRules.filter((r) => req.activeRules.has(r.id));
  // Les règles "satellites" (collecte partagée) : s'assurer que la règle collectrice tourne.
  const needsCraftCollector = [
    'craft/missing-loading-state',
    'craft/missing-empty-state',
    'craft/missing-hover-transition',
    'craft/state-naming',
    'craft/inconsistent-motion',
    'craft/missing-success-state',
    'craft/duplicate-state',
    'craft/state-matrix-thin',
    'craft/inconsistent-easing',
    'components/orphan-variant',
  ];
  if (needsCraftCollector.some((id) => req.activeRules.has(id)) && !rules.some((r) => r.id === 'craft/missing-state')) {
    const collector = allRules.find((r) => r.id === 'craft/missing-state');
    if (collector) rules.push(collector);
  }
  if (req.activeRules.has('a11y/contrast-not-verifiable') && !rules.some((r) => r.id === 'a11y/text-contrast')) {
    const contrast = allRules.find((r) => r.id === 'a11y/text-contrast');
    if (contrast) rules.push(contrast);
  }
  const checkRules = rules.filter((r) => r.check);
  const finalizeRules = rules.filter((r) => r.finalize);

  const finish = (cancelled: boolean, scope: ScanScope, label: string, pages: number, scanned: number): EngineOutput => ({
    cancelled,
    plans,
    result: {
      issues,
      stats: {
        nodesScanned: scanned,
        durationMs: Date.now() - started,
        scope,
        scopeLabel: label,
        pagesScanned: pages,
        interactiveComponents: ctx.componentSets.filter((s) => s.stateProp || INTERACTIVE_KINDS.has(s.kind)).length,
        tokens: {
          colorVariables: ctx.colors.length,
          floatVariables: ctx.floats.length,
          textStyles: ctx.textStyles.length,
          paintStyles: ctx.paintStyles.length,
          libraries: ctx.libraries.length,
        },
        warnings: ctx.warnings,
      },
    },
  });

  // 1. Périmètre
  const { roots, pages } = await resolveRoots(req.scope);
  const label = scopeLabel(req.scope, roots);

  // 2. Index des tokens
  emit({ phase: 'indexing' });
  await indexTokens(ctx);
  if (isCancelled()) return finish(true, req.scope, label, pages, 0);

  // 3. Collecte des nodes
  emit({ phase: 'collecting' });
  const types = collectTypes(checkRules);
  const nodes = await collectNodes(roots, types, ctx);
  if (isCancelled()) return finish(true, req.scope, label, pages, 0);
  await learnRemoteStyles(nodes, ctx);
  emit({ phase: 'scanning', scanned: 0, total: nodes.length });

  // 4. Parcours par lots
  const byType = new Map<string, Rule[]>();
  for (const t of types) byType.set(t, checkRules.filter((r) => !r.types || r.types.includes(t)));

  // Le bac à sable partage le thread principal de Figma : on rend la main à intervalle
  // de temps fixe (pas par nombre de calques), et une règle anormalement lente sur ce
  // fichier est suspendue plutôt que de figer l'éditeur.
  let scanned = 0;
  const ruleTime = new Map<string, number>();
  const suspended = new Set<string>();
  let lastYield = Date.now();
  let sinceCheck = 0;
  for (const node of nodes) {
    scanned++;
    if (!node.removed && !(req.options.ignoreHidden && isEffectivelyHidden(node, ctx)) && !(req.options.ignoreLocked && isEffectivelyLocked(node, ctx))) {
      const inside = !req.options.scanInsideInstances && isInsideInstance(node, ctx);
      const applicable = byType.get(node.type) ?? [];
      for (const rule of applicable) {
        if ((inside && !rule.insideInstances) || suspended.has(rule.id)) continue;
        const t0 = Date.now();
        try {
          const raws = await rule.check!(node, ctx);
          if (raws) for (const raw of raws) push(raw);
        } catch {
          // Une règle ne doit jamais faire tomber le scan.
          ctx.warnings.push(`rule:${rule.id}`);
        }
        const spent = (ruleTime.get(rule.id) ?? 0) + (Date.now() - t0);
        ruleTime.set(rule.id, spent);
        if (spent > RULE_TIME_BUDGET_MS) {
          suspended.add(rule.id);
          ctx.warnings.push(`rule-slow:${rule.id}`);
        }
      }
    }
    if (++sinceCheck >= 8) {
      sinceCheck = 0;
      if (Date.now() - lastYield >= YIELD_EVERY_MS) {
        emit({ phase: 'scanning', scanned, total: nodes.length });
        await yieldToHost();
        lastYield = Date.now();
        if (isCancelled()) return finish(true, req.scope, label, pages, scanned);
      }
    }
  }
  emit({ phase: 'scanning', scanned, total: nodes.length });
  await yieldToHost();
  if (isCancelled()) return finish(true, req.scope, label, pages, scanned);

  // 5. Règles agrégées
  emit({ phase: 'finalizing', scanned, total: nodes.length });
  for (const rule of finalizeRules) {
    if (suspended.has(rule.id)) continue;
    try {
      const raws = await rule.finalize!(ctx);
      if (raws) for (const raw of raws) push(raw);
    } catch {
      ctx.warnings.push(`rule:${rule.id}`);
    }
    await yieldToHost();
    if (isCancelled()) return finish(true, req.scope, label, pages, scanned);
  }
  // Dédoublonne les avertissements.
  ctx.warnings.splice(0, ctx.warnings.length, ...new Set(ctx.warnings));

  // Tri : erreurs d'abord, puis catégorie, puis valeur.
  const sevOrder = { error: 0, warning: 1, info: 2 };
  const catOrder: Record<Category, number> = { colors: 0, typography: 1, spacing: 2, radius: 3, components: 4, tokens: 5, craft: 6, a11y: 7, handoff: 8 };
  issues.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || catOrder[a.category] - catOrder[b.category] || a.groupKey.localeCompare(b.groupKey));

  return finish(false, req.scope, label, pages, scanned);
}
