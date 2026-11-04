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

// ---------------------------------------------------------------------------
// Craft Readiness (Pro) : préparation interactionnelle, séparée du Design Health
// ---------------------------------------------------------------------------

export type CraftArea = 'states' | 'feedback' | 'recovery' | 'motion';

export interface CraftAreaScore {
  area: CraftArea;
  score: number;
  max: number;
  /** Issues ouvertes comptées dans cet axe. */
  issues: number;
}

export interface CraftReadiness {
  total: number;
  areas: CraftAreaScore[];
}

/** Poids, règles et capacité (issues tolérées par composant interactif avant 0) de chaque axe. */
export const CRAFT_AREAS: Record<CraftArea, { max: number; rules: string[]; perComponent: number }> = {
  states: {
    max: 50,
    rules: ['craft/missing-state', 'craft/duplicate-state', 'craft/state-matrix-thin', 'craft/state-naming'],
    perComponent: 4,
  },
  feedback: {
    max: 20,
    rules: ['craft/missing-loading-state', 'craft/missing-success-state', 'craft/missing-hover-transition'],
    perComponent: 2,
  },
  recovery: {
    max: 15,
    rules: ['craft/missing-empty-state', 'craft/error-without-recovery', 'craft/generic-error-message', 'craft/destructive-without-confirm'],
    perComponent: 2,
  },
  motion: {
    max: 15,
    rules: ['craft/inconsistent-motion', 'craft/inconsistent-easing', 'craft/transition-too-long', 'craft/non-reversible-hover'],
    perComponent: 2,
  },
};

const CRAFT_WEIGHT: Record<Severity, number> = { error: 1, warning: 0.75, info: 0.4 };

/**
 * Chaque axe part de son maximum et décroît avec la pénalité pondérée des issues ouvertes,
 * rapportée à une capacité proportionnelle au nombre de composants interactifs (au moins 3).
 */
export function computeCraftReadiness(issues: Issue[], interactiveComponents: number): CraftReadiness {
  const base = Math.max(3, interactiveComponents);
  const areas: CraftAreaScore[] = [];
  let total = 0;
  for (const [area, def] of Object.entries(CRAFT_AREAS) as [CraftArea, (typeof CRAFT_AREAS)[CraftArea]][]) {
    const rules = new Set(def.rules);
    let penalty = 0;
    let count = 0;
    for (const issue of issues) {
      if (issue.status !== 'open' || !rules.has(issue.ruleId)) continue;
      penalty += CRAFT_WEIGHT[issue.severity];
      count++;
    }
    const capacity = base * def.perComponent;
    const score = Math.round(def.max * Math.max(0, 1 - penalty / capacity));
    areas.push({ area, score, max: def.max, issues: count });
    total += score;
  }
  return { total, areas };
}
