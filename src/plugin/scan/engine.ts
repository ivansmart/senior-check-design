/// <reference types="@figma/plugin-typings" />
import { RULE_BY_ID } from '../../shared/rules-catalog';
import type { Category, Issue, ScanOptions, ScanProgress, ScanResult, ScanScope } from '../../shared/types';
import type { FixPlan } from '../fix/plans';
import { ALL_RULES } from '../rules';
import type { Rule } from '../rules/types';
import { createContext, indexPaintStyle, indexTextStyle, indexTokens, rebuildScales, yieldToHost, type RawIssue, type ScanContext } from './context';
import { isEffectivelyHidden, isEffectivelyLocked, isInsideInstance, pageOf, pathOf } from './node-info';

export interface ScanRequest {
  scope: ScanScope;
  options: ScanOptions;
  activeRules: Set<string>;
  ignoredIssueIds: Set<string>;
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

const BATCH_SIZE = 120;
const MAX_LEARNED_STYLES = 300;

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
  let i = 0;
  for (const id of textIds) {
    if (knownText.has(id)) continue;
    try {
      const s = await figma.getStyleByIdAsync(id);
      if (s && s.type === 'TEXT') indexTextStyle(ctx, s);
    } catch {
      /* style inaccessible */
    }
    if (++i % 40 === 0) await yieldToHost();
  }
  for (const id of paintIds) {
    if (knownPaint.has(id)) continue;
    try {
      const s = await figma.getStyleByIdAsync(id);
      if (s && s.type === 'PAINT') await indexPaintStyle(ctx, s);
    } catch {
      /* style inaccessible */
    }
    if (++i % 40 === 0) await yieldToHost();
  }
  rebuildScales(ctx);
}

function toIssue(raw: RawIssue, ctx: ScanContext, ignored: Set<string>): Issue {
  const meta = RULE_BY_ID[raw.ruleId];
  const id = `${raw.ruleId}::${raw.node.id}::${raw.slot ?? ''}`;
  const page = pageOf(raw.node);
  const severity = raw.severity ?? meta.severity;
  return {
    id,
    ruleId: raw.ruleId,
    category: meta.category,
    severity,
    nodeId: raw.node.id,
    nodeName: raw.node.name,
    nodeType: raw.node.type,
    nodePath: pathOf(raw.node, ctx),
    pageId: page?.id ?? '',
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

  const rules = ALL_RULES.filter((r) => req.activeRules.has(r.id));
  // Les règles "satellites" (collecte partagée) : s'assurer que la règle collectrice tourne.
  const needsCraftCollector = ['craft/missing-loading-state', 'craft/missing-empty-state', 'craft/missing-hover-transition', 'craft/state-naming', 'craft/inconsistent-motion'];
  if (needsCraftCollector.some((id) => req.activeRules.has(id)) && !rules.some((r) => r.id === 'craft/missing-state')) {
    const collector = ALL_RULES.find((r) => r.id === 'craft/missing-state')!;
    rules.push(collector);
  }
  if (req.activeRules.has('a11y/contrast-not-verifiable') && !rules.some((r) => r.id === 'a11y/text-contrast')) {
    rules.push(ALL_RULES.find((r) => r.id === 'a11y/text-contrast')!);
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

  let scanned = 0;
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    for (const node of batch) {
      scanned++;
      if (node.removed) continue;
      if (req.options.ignoreHidden && isEffectivelyHidden(node, ctx)) continue;
      if (req.options.ignoreLocked && isEffectivelyLocked(node, ctx)) continue;
      const inside = !req.options.scanInsideInstances && isInsideInstance(node, ctx);
      const applicable = byType.get(node.type) ?? [];
      for (const rule of applicable) {
        if (inside && !rule.insideInstances) continue;
        try {
          const raws = await rule.check!(node, ctx);
          if (raws) for (const raw of raws) push(raw);
        } catch (e) {
          // Une règle ne doit jamais faire tomber le scan.
          ctx.warnings.push(`rule:${rule.id}`);
        }
      }
    }
    emit({ phase: 'scanning', scanned, total: nodes.length });
    await yieldToHost();
    if (isCancelled()) return finish(true, req.scope, label, pages, scanned);
  }

  // 5. Règles agrégées
  emit({ phase: 'finalizing', scanned, total: nodes.length });
  for (const rule of finalizeRules) {
    try {
      const raws = await rule.finalize!(ctx);
      if (raws) for (const raw of raws) push(raw);
    } catch {
      ctx.warnings.push(`rule:${rule.id}`);
    }
  }
  // Dédoublonne les avertissements.
  ctx.warnings.splice(0, ctx.warnings.length, ...new Set(ctx.warnings));

  // Tri : erreurs d'abord, puis catégorie, puis valeur.
  const sevOrder = { error: 0, warning: 1, info: 2 };
  const catOrder: Record<Category, number> = { colors: 0, typography: 1, spacing: 2, radius: 3, components: 4, craft: 5, a11y: 6, handoff: 7 };
  issues.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || catOrder[a.category] - catOrder[b.category] || a.groupKey.localeCompare(b.groupKey));

  return finish(false, req.scope, label, pages, scanned);
}
