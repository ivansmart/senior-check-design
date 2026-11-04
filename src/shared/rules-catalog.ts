import type { Category, PluginMode, PresetId, Severity } from './types';

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
  /** `pro` : règle de la V2, active uniquement en mode Pro. */
  tier?: 'pro';
  /** Lien de documentation (optionnel, ouvert dans le navigateur). */
  docUrl?: string;
}

const WCAG = 'https://www.w3.org/WAI/WCAG22/Understanding/';

export const RULES: RuleMeta[] = [
  // Couleurs
  { id: 'colors/hardcoded-fill', category: 'colors', severity: 'error' },
  { id: 'colors/hardcoded-stroke', category: 'colors', severity: 'error' },

  // Typographie
  { id: 'typography/no-text-style', category: 'typography', severity: 'error' },
  { id: 'typography/mixed-styles', category: 'typography', severity: 'info' },
  { id: 'typography/off-scale-size', category: 'typography', severity: 'warning' },
  { id: 'typography/near-duplicate-styles', category: 'typography', severity: 'info', aggregate: true, tier: 'pro' },
  { id: 'typography/line-length', category: 'typography', severity: 'info', tier: 'pro' },
  { id: 'typography/line-height-inconsistent', category: 'typography', severity: 'warning', aggregate: true, tier: 'pro' },
  { id: 'typography/label-case', category: 'typography', severity: 'info', aggregate: true, tier: 'pro' },

  // Espacement et layout
  { id: 'spacing/off-scale-padding', category: 'spacing', severity: 'warning' },
  { id: 'spacing/off-scale-gap', category: 'spacing', severity: 'warning' },
  { id: 'spacing/rhythm-near-miss', category: 'spacing', severity: 'info', aggregate: true, tier: 'pro' },
  { id: 'spacing/fixed-should-fill', category: 'spacing', severity: 'warning', tier: 'pro' },
  { id: 'spacing/fixed-should-hug', category: 'spacing', severity: 'info', tier: 'pro' },
  { id: 'spacing/text-overlap', category: 'spacing', severity: 'warning', tier: 'pro' },

  // Radius
  { id: 'radius/not-tokenized', category: 'radius', severity: 'warning' },

  // Composants
  { id: 'components/detached-instance', category: 'components', severity: 'warning' },
  { id: 'components/default-name', category: 'components', severity: 'info' },
  { id: 'components/heavy-overrides', category: 'components', severity: 'info' },
  { id: 'components/duplicate-component', category: 'components', severity: 'info', aggregate: true },
  { id: 'components/no-description', category: 'components', severity: 'info' },
  { id: 'components/reattach-instance', category: 'components', severity: 'warning', tier: 'pro' },
  { id: 'components/deprecated-in-use', category: 'components', severity: 'warning', tier: 'pro' },
  { id: 'components/orphan-variant', category: 'components', severity: 'info', aggregate: true, tier: 'pro' },
  { id: 'components/useless-nesting', category: 'components', severity: 'info', tier: 'pro' },
  { id: 'components/no-doc-link', category: 'components', severity: 'info', aggregate: true, tier: 'pro' },
  { id: 'components/no-status', category: 'components', severity: 'info', aggregate: true, tier: 'pro' },

  // Architecture des tokens (Pro)
  { id: 'tokens/broken-alias', category: 'tokens', severity: 'error', aggregate: true, tier: 'pro' },
  { id: 'tokens/circular-alias', category: 'tokens', severity: 'error', aggregate: true, tier: 'pro' },
  { id: 'tokens/orphan', category: 'tokens', severity: 'info', aggregate: true, tier: 'pro' },
  { id: 'tokens/duplicate-value', category: 'tokens', severity: 'info', aggregate: true, tier: 'pro' },
  { id: 'tokens/primitive-bound', category: 'tokens', severity: 'warning', tier: 'pro' },
  { id: 'tokens/mode-gap', category: 'tokens', severity: 'info', aggregate: true, tier: 'pro' },
  { id: 'tokens/unscoped', category: 'tokens', severity: 'info', aggregate: true, tier: 'pro' },

  // Craft & interaction
  { id: 'craft/missing-state', category: 'craft', severity: 'warning' },
  { id: 'craft/missing-loading-state', category: 'craft', severity: 'warning' },
  { id: 'craft/missing-empty-state', category: 'craft', severity: 'warning' },
  { id: 'craft/state-naming', category: 'craft', severity: 'info', aggregate: true },
  { id: 'craft/missing-hover-transition', category: 'craft', severity: 'info' },
  { id: 'craft/inconsistent-motion', category: 'craft', severity: 'warning', aggregate: true },
  { id: 'craft/missing-success-state', category: 'craft', severity: 'info', tier: 'pro' },
  { id: 'craft/destructive-without-confirm', category: 'craft', severity: 'warning', aggregate: true, tier: 'pro' },
  { id: 'craft/error-without-recovery', category: 'craft', severity: 'warning', tier: 'pro' },
  { id: 'craft/generic-error-message', category: 'craft', severity: 'info', tier: 'pro' },
  { id: 'craft/duplicate-state', category: 'craft', severity: 'warning', tier: 'pro' },
  { id: 'craft/state-matrix-thin', category: 'craft', severity: 'info', tier: 'pro' },
  { id: 'craft/inconsistent-easing', category: 'craft', severity: 'warning', aggregate: true, tier: 'pro' },
  { id: 'craft/transition-too-long', category: 'craft', severity: 'warning', tier: 'pro' },
  { id: 'craft/non-reversible-hover', category: 'craft', severity: 'warning', tier: 'pro' },

  // Accessibilité
  { id: 'a11y/text-contrast', category: 'a11y', severity: 'error', docUrl: `${WCAG}contrast-minimum.html` },
  { id: 'a11y/contrast-not-verifiable', category: 'a11y', severity: 'info' },
  { id: 'a11y/touch-target', category: 'a11y', severity: 'warning', docUrl: `${WCAG}target-size-minimum.html` },
  { id: 'a11y/text-too-small', category: 'a11y', severity: 'info' },
  { id: 'a11y/heading-skip', category: 'a11y', severity: 'info', aggregate: true, tier: 'pro', docUrl: `${WCAG}info-and-relationships.html` },
  { id: 'a11y/icon-contrast', category: 'a11y', severity: 'warning', tier: 'pro', docUrl: `${WCAG}non-text-contrast.html` },
  { id: 'a11y/border-contrast', category: 'a11y', severity: 'warning', tier: 'pro', docUrl: `${WCAG}non-text-contrast.html` },
  { id: 'a11y/icon-only-without-label', category: 'a11y', severity: 'warning', tier: 'pro', docUrl: `${WCAG}name-role-value.html` },
  { id: 'a11y/color-only-status', category: 'a11y', severity: 'info', tier: 'pro', docUrl: `${WCAG}use-of-color.html` },

  // Handoff
  { id: 'handoff/fractional-size', category: 'handoff', severity: 'info' },
  { id: 'handoff/fractional-position', category: 'handoff', severity: 'info' },
  { id: 'handoff/stackable-without-autolayout', category: 'handoff', severity: 'info' },
  { id: 'handoff/repeated-pattern', category: 'handoff', severity: 'info', tier: 'pro' },
  { id: 'handoff/image-crop', category: 'handoff', severity: 'info', tier: 'pro' },
];

export const RULE_BY_ID: Record<string, RuleMeta> = Object.fromEntries(RULES.map((r) => [r.id, r]));

export const ALL_RULE_IDS = RULES.map((r) => r.id);
export const CLASSIC_RULE_IDS = RULES.filter((r) => !r.tier).map((r) => r.id);
export const PRO_RULE_IDS = RULES.filter((r) => r.tier === 'pro').map((r) => r.id);

const byCategory = (...cats: Category[]) => RULES.filter((r) => cats.includes(r.category)).map((r) => r.id);
const byPrefix = (...prefixes: string[]) => ALL_RULE_IDS.filter((id) => prefixes.some((p) => id.startsWith(p)));
const unique = (ids: string[]) => [...new Set(ids)];

/** Règles activées par preset. "strict" active tout ; les règles Pro ne s'appliquent qu'en mode Pro. */
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
  handoff: unique([
    ...byCategory('colors', 'typography', 'spacing', 'radius', 'handoff'),
    'components/detached-instance',
    'components/default-name',
    'components/heavy-overrides',
    'components/reattach-instance',
    'components/deprecated-in-use',
    'components/useless-nesting',
  ]),
  'design-system': unique([
    ...byCategory('colors', 'typography', 'spacing', 'radius', 'components', 'tokens'),
    'craft/state-naming',
    'craft/missing-state',
    'craft/duplicate-state',
    'craft/state-matrix-thin',
  ]),
  a11y: unique([...byCategory('a11y'), 'craft/missing-state']),
  craft: unique([...byCategory('craft'), 'a11y/touch-target', 'a11y/icon-only-without-label']),
  preflight: unique([
    ...byCategory('tokens', 'components', 'craft', 'handoff'),
    ...byPrefix('colors/', 'radius/'),
    'typography/no-text-style',
    'typography/near-duplicate-styles',
    'typography/line-height-inconsistent',
    'spacing/off-scale-padding',
    'spacing/off-scale-gap',
    'spacing/fixed-should-fill',
    'a11y/text-contrast',
    'a11y/icon-contrast',
    'a11y/touch-target',
  ]),
  strict: ALL_RULE_IDS,
};

export const PRESET_IDS: PresetId[] = ['quick', 'handoff', 'design-system', 'a11y', 'craft', 'preflight', 'strict'];
/** Presets qui n'ont de sens qu'en mode Pro. */
export const PRO_PRESET_IDS: PresetId[] = ['preflight'];

/** Résout l'ensemble final de règles actives pour un scan. En mode Classique, les règles Pro sont exclues. */
export function resolveActiveRules(preset: PresetId, disabled: string[], enabled: string[], mode: PluginMode = 'pro'): Set<string> {
  const set = new Set<string>(PRESETS[preset] ?? PRESETS.quick);
  for (const id of enabled) if (RULE_BY_ID[id]) set.add(id);
  for (const id of disabled) set.delete(id);
  if (mode === 'classic') for (const id of PRO_RULE_IDS) set.delete(id);
  return set;
}
