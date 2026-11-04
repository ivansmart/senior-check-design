import type { Category, Issue, ScoreBreakdown, Severity } from './types';

export const SEVERITY_WEIGHT: Record<Severity, number> = { error: 3, warning: 1.5, info: 0.5 };

/**
 * Design Health : 100 pour aucun problème, décroît avec la densité d'issues
 * ouvertes par node analysé. score = 100 / (1 + 4·d), d = pénalité / nodes.
 * Repères : 1 erreur / 10 nodes ≈ 45 ; 1 warning / 15 nodes ≈ 71 ; 1 info / 25 nodes ≈ 93.
 */
export function computeScore(issues: Issue[], nodesScanned: number): ScoreBreakdown {
  const nodes = Math.max(nodesScanned, 20);
  const penalty: Partial<Record<Category, number>> = {};
  let total = 0;
  for (const issue of issues) {
    if (issue.status !== 'open') continue;
    const w = SEVERITY_WEIGHT[issue.severity];
    penalty[issue.category] = (penalty[issue.category] ?? 0) + w;
    total += w;
  }
  const scoreFor = (p: number) => Math.round(100 / (1 + 4 * (p / nodes)));
  const byCategory: Partial<Record<Category, number>> = {};
  for (const [cat, p] of Object.entries(penalty) as [Category, number][]) byCategory[cat] = scoreFor(p);
  return { total: scoreFor(total), byCategory };
}

export function countBySeverity(issues: Issue[]): Record<Severity, number> {
  const out: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const i of issues) if (i.status === 'open') out[i.severity]++;
  return out;
}

export function countSafeFixes(issues: Issue[]): number {
  return issues.filter((i) => i.status === 'open' && i.fixSafety === 'safe').length;
}
