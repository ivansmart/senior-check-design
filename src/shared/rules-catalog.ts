import type { Category, PresetId, Severity } from './types';

/**
 * Catalogue déclaratif des règles. La logique de détection vit dans
 * src/plugin/rules ; les textes (titre, pourquoi, suggestion) vivent dans l'UI (i18n).
 */
export interface RuleMeta {
  id: string;
  category: Category;
  severity: Severity;
  /** Une règle "aggregate" s'exécute après le parcours des nodes. */
  aggregate?: boolean;
  /** Lien de documentation (optionnel, ouvert dans le navigateur). */
  docUrl?: string;
}

export const RULES: RuleMeta[] = [
  // Couleurs
  { id: 'colors/hardcoded-fill', category: 'colors', severity: 'error' },
  { id: 'colors/hardcoded-stroke', category: 'colors', severity: 'error' },

  // Typographie
  { id: 'typography/no-text-style', category: 'typography', severity: 'error' },
  { id: 'typography/mixed-styles', category: 'typography', severity: 'info' },
  { id: 'typography/off-scale-size', category: 'typography', severity: 'warning' },

  // Espacement
  { id: 'spacing/off-scale-padding', category: 'spacing', severity: 'warning' },
  { id: 'spacing/off-scale-gap', category: 'spacing', severity: 'warning' },

  // Radius
  { id: 'radius/not-tokenized', category: 'radius', severity: 'warning' },

  // Composants
  { id: 'components/detached-instance', category: 'components', severity: 'warning' },
  { id: 'components/default-name', category: 'components', severity: 'info' },
  { id: 'components/heavy-overrides', category: 'components', severity: 'info' },
  { id: 'components/duplicate-component', category: 'components', severity: 'info', aggregate: true },
  { id: 'components/no-description', category: 'components', severity: 'info' },

  // Craft & interaction
  { id: 'craft/missing-state', category: 'craft', severity: 'warning' },
  { id: 'craft/missing-loading-state', category: 'craft', severity: 'warning' },
  { id: 'craft/missing-empty-state', category: 'craft', severity: 'warning' },
  { id: 'craft/state-naming', category: 'craft', severity: 'info', aggregate: true },
  { id: 'craft/missing-hover-transition', category: 'craft', severity: 'info' },
  { id: 'craft/inconsistent-motion', category: 'craft', severity: 'warning', aggregate: true },

  // Accessibilité
  {
    id: 'a11y/text-contrast',
    category: 'a11y',
    severity: 'error',
    docUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
  },
  { id: 'a11y/contrast-not-verifiable', category: 'a11y', severity: 'info' },
  {
    id: 'a11y/touch-target',
    category: 'a11y',
    severity: 'warning',
    docUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
  },
  { id: 'a11y/text-too-small', category: 'a11y', severity: 'info' },

  // Handoff
  { id: 'handoff/fractional-size', category: 'handoff', severity: 'info' },
  { id: 'handoff/fractional-position', category: 'handoff', severity: 'info' },
  { id: 'handoff/stackable-without-autolayout', category: 'handoff', severity: 'info' },
];

export const RULE_BY_ID: Record<string, RuleMeta> = Object.fromEntries(RULES.map((r) => [r.id, r]));

export const ALL_RULE_IDS = RULES.map((r) => r.id);

const byCategory = (...cats: Category[]) => RULES.filter((r) => cats.includes(r.category)).map((r) => r.id);

/** Règles activées par preset. "strict" active tout. */
export const PRESETS: Record<PresetId, string[]> = {
  quick: [
    'colors/hardcoded-fill',
    'colors/hardcoded-stroke',
    'typography/no-text-style',
    'spacing/off-scale-padding',
    'spacing/off-scale-gap',
    'components/detached-instance',
    'components/default-name',
  ],
  handoff: [
    ...byCategory('colors', 'typography', 'spacing', 'radius', 'handoff'),
    'components/detached-instance',
    'components/default-name',
    'components/heavy-overrides',
  ],
  'design-system': [
    ...byCategory('colors', 'typography', 'spacing', 'radius', 'components'),
    'craft/state-naming',
    'craft/missing-state',
  ],
  a11y: [...byCategory('a11y'), 'craft/missing-state'],
  craft: [...byCategory('craft'), 'a11y/touch-target'],
  strict: ALL_RULE_IDS,
};

export const PRESET_IDS: PresetId[] = ['quick', 'handoff', 'design-system', 'a11y', 'craft', 'strict'];

/** Résout l'ensemble final de règles actives pour un scan. */
export function resolveActiveRules(preset: PresetId, disabled: string[], enabled: string[]): Set<string> {
  const set = new Set<string>(PRESETS[preset] ?? PRESETS.quick);
  for (const id of enabled) if (RULE_BY_ID[id]) set.add(id);
  for (const id of disabled) set.delete(id);
  return set;
}
