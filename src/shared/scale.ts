import type { MatchConfidence } from './types';

export interface ScaleCandidate<T = unknown> {
  value: number;
  ref: T;
}

export interface ScaleMatch<T = unknown> {
  confidence: MatchConfidence;
  best?: ScaleCandidate<T>;
  /** Candidats pertinents (dans l'ordre de distance croissante). */
  candidates: ScaleCandidate<T>[];
}

const EPS = 0.01;

/**
 * Cherche `value` dans une échelle de candidats.
 * - exact     : |Δ| < 0.01
 * - close     : un seul candidat dans la tolérance
 * - ambiguous : plusieurs candidats dans la tolérance à distance comparable
 * - none      : aucun candidat dans la tolérance
 */
export function matchScale<T>(value: number, candidates: ScaleCandidate<T>[], tolerance: number): ScaleMatch<T> {
  if (!candidates.length) return { confidence: 'none', candidates: [] };
  const sorted = candidates
    .map((c) => ({ c, d: Math.abs(c.value - value) }))
    .sort((a, b) => a.d - b.d);
  const [first, second] = sorted;
  if (first.d < EPS) return { confidence: 'exact', best: first.c, candidates: [first.c] };
  const within = sorted.filter((s) => s.d <= tolerance + EPS);
  if (!within.length) return { confidence: 'none', candidates: [] };
  if (within.length >= 2 && second && Math.abs(second.d - first.d) <= 1 + EPS) {
    return { confidence: 'ambiguous', best: first.c, candidates: within.slice(0, 3).map((s) => s.c) };
  }
  return { confidence: 'close', best: first.c, candidates: within.slice(0, 3).map((s) => s.c) };
}

/** Un nombre est "sur la grille" s'il est un multiple (± 0.01) de `grid`. Zéro compte comme sur la grille. */
export function isOnGrid(value: number, grid: number): boolean {
  if (grid <= 0) return true;
  const r = Math.abs(value) % grid;
  return r < EPS || Math.abs(r - grid) < EPS;
}

export function isInteger(value: number, eps = 0.01): boolean {
  return Math.abs(value - Math.round(value)) < eps;
}

/** Formate un nombre en px avec au plus 2 décimales. */
export function px(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0+$/, '')} px`;
}
