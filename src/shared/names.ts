/** Heuristiques de nommage : noms par défaut Figma, vocabulaire d'états, "genre" de composant. */

const DEFAULT_NAME_RE =
  /^(Frame|Group|Rectangle|Ellipse|Polygon|Star|Line|Arrow|Vector|Image|Text|Component|Section|Slice|Union|Subtract|Intersect|Exclude|Boolean(?: Group)?|Instance|Mask(?: group)?)(?:\s+\d+)?(?:\s+copy(?:\s+\d+)?)?$/i;

export function isDefaultName(name: string): boolean {
  return DEFAULT_NAME_RE.test(name.trim());
}

/** Normalise une valeur de variante : casse, accents, ponctuation, préfixes. */
export function normalizeStateValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^(state|status|etat)[-_:= ]*/, '')
    .replace(/^[:._-]+/, '')
    .replace(/[\s_.-]+/g, '-')
    .trim();
}

/** États canoniques et leurs alias fréquents (déjà normalisés). */
export const STATE_ALIASES: Record<string, string[]> = {
  default: ['default', 'rest', 'idle', 'normal', 'enabled', 'base', 'defaut', 'repos'],
  hover: ['hover', 'hovered', 'mouse-over', 'mouseover', 'over', 'survol'],
  pressed: ['pressed', 'active', 'press', 'down', 'mouse-down', 'clicked', 'appuye', 'actif'],
  focus: ['focus', 'focused', 'focus-visible', 'focussed', 'keyboard', 'focalise'],
  disabled: ['disabled', 'inactive', 'off-disabled', 'unavailable', 'desactive', 'inactif'],
  loading: ['loading', 'busy', 'pending', 'spinner', 'progress', 'chargement'],
  error: ['error', 'invalid', 'danger', 'erreur', 'invalide'],
  success: ['success', 'valid', 'done', 'succes', 'valide'],
  selected: ['selected', 'checked', 'on', 'active-selected', 'selectionne', 'coche', 'true'],
  unselected: ['unselected', 'unchecked', 'off', 'non-coche', 'false'],
  empty: ['empty', 'no-results', 'no-result', 'nothing', 'vide', 'aucun-resultat'],
  filled: ['filled', 'with-value', 'value', 'rempli'],
  readonly: ['readonly', 'read-only', 'lecture-seule'],
};

const aliasToCanonical = new Map<string, string>();
for (const [canon, aliases] of Object.entries(STATE_ALIASES)) {
  for (const a of aliases) aliasToCanonical.set(a, canon);
}

/** Retourne l'état canonique d'une valeur de variante, ou null si inconnu. */
export function canonicalState(value: string): string | null {
  const norm = normalizeStateValue(value);
  if (aliasToCanonical.has(norm)) return aliasToCanonical.get(norm)!;
  // "Hover + Focus", "Hover/Focus"
  const parts = norm.split(/[+/,&]/).map((p) => p.replace(/^-+|-+$/g, '').trim());
  if (parts.length > 1) {
    for (const p of parts) if (aliasToCanonical.has(p)) return aliasToCanonical.get(p)!;
  }
  return null;
}

/** Une propriété de variante "ressemble" à une propriété d'état ? */
export function isStateProperty(propName: string, values: string[]): boolean {
  const n = normalizeStateValue(propName);
  if (/^(state|status|interaction|etat|mode-interaction)$/.test(n)) return true;
  // Sinon : au moins 2 valeurs reconnues comme états.
  const recognized = values.filter((v) => canonicalState(v) !== null).length;
  return recognized >= 2 && recognized >= values.length / 2;
}

export type ComponentKind =
  | 'button'
  | 'link'
  | 'input'
  | 'select'
  | 'checkbox'
  | 'toggle'
  | 'radio'
  | 'chip'
  | 'tab'
  | 'list'
  | 'table'
  | 'search'
  | 'card'
  | 'icon-button'
  | 'unknown';

const KIND_PATTERNS: [ComponentKind, RegExp][] = [
  ['icon-button', /icon[\s_-]?(button|btn)|btn[\s_-]?icon|icon-only/i],
  ['button', /\b(button|btn|cta)\b|bouton/i],
  ['link', /\blink\b|lien/i],
  ['search', /search|recherche/i],
  ['input', /\b(input|text[\s_-]?field|textfield|textarea|field|champ)\b/i],
  ['select', /\b(select|dropdown|combobox|combo[\s_-]?box|picker)\b/i],
  ['checkbox', /checkbox|check[\s_-]?box|case/i],
  ['radio', /\bradio\b/i],
  ['toggle', /toggle|switch|interrupteur/i],
  ['chip', /\b(chip|tag|pill|filter)\b|badge-filter/i],
  ['tab', /\btabs?\b|onglet|segment/i],
  ['table', /\btable\b|data[\s_-]?grid|tableau/i],
  ['list', /\blist\b|liste|feed|results|resultats/i],
  ['card', /\bcard\b|carte|tile/i],
];

export function inferComponentKind(name: string, description = ''): ComponentKind {
  const hay = `${name} ${description}`;
  for (const [kind, re] of KIND_PATTERNS) if (re.test(hay)) return kind;
  return 'unknown';
}

/** États attendus par genre de composant interactif. */
export const EXPECTED_STATES: Partial<Record<ComponentKind, { state: string; severity: 'error' | 'warning' }[]>> = {
  button: [
    { state: 'hover', severity: 'warning' },
    { state: 'pressed', severity: 'warning' },
    { state: 'focus', severity: 'error' },
    { state: 'disabled', severity: 'warning' },
  ],
  'icon-button': [
    { state: 'hover', severity: 'warning' },
    { state: 'pressed', severity: 'warning' },
    { state: 'focus', severity: 'error' },
    { state: 'disabled', severity: 'warning' },
  ],
  link: [
    { state: 'hover', severity: 'warning' },
    { state: 'focus', severity: 'error' },
  ],
  input: [
    { state: 'focus', severity: 'error' },
    { state: 'error', severity: 'error' },
    { state: 'disabled', severity: 'warning' },
  ],
  search: [
    { state: 'focus', severity: 'error' },
    { state: 'disabled', severity: 'warning' },
  ],
  select: [
    { state: 'focus', severity: 'error' },
    { state: 'error', severity: 'error' },
    { state: 'disabled', severity: 'warning' },
  ],
  checkbox: [
    { state: 'selected', severity: 'error' },
    { state: 'focus', severity: 'error' },
    { state: 'disabled', severity: 'warning' },
  ],
  radio: [
    { state: 'selected', severity: 'error' },
    { state: 'focus', severity: 'error' },
    { state: 'disabled', severity: 'warning' },
  ],
  toggle: [
    { state: 'selected', severity: 'error' },
    { state: 'focus', severity: 'error' },
    { state: 'disabled', severity: 'warning' },
  ],
  chip: [
    { state: 'selected', severity: 'error' },
    { state: 'hover', severity: 'warning' },
  ],
  tab: [
    { state: 'selected', severity: 'error' },
    { state: 'hover', severity: 'warning' },
    { state: 'focus', severity: 'error' },
  ],
};

/** Verbes d'action "longue" qui justifient un état loading. */
const ACTION_VERB_RE =
  /\b(submit|pay|payer|paiement|checkout|send|envoyer|save|enregistrer|sauvegarder|upload|televerser|importer|export|download|telecharger|confirm|confirmer|order|commander|buy|acheter|sign ?in|sign ?up|log ?in|connexion|inscription|continue|continuer|next|suivant|apply|appliquer|publish|publier|generate|generer|search|rechercher|add to cart|ajouter au panier|delete|supprimer|primary|principal)\b/i;

export function looksLikeLongAction(text: string): boolean {
  return ACTION_VERB_RE.test(text);
}

/** Genres de composants pour lesquels un état "empty" est attendu. */
export const EMPTY_STATE_KINDS: ComponentKind[] = ['list', 'table', 'search'];

/** Nom "humain" d'un chemin (évite les noms trop longs). */
export function ellipsize(s: string, max = 28): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, Math.floor(max / 2) - 1)) + '…' + s.slice(-Math.floor(max / 2));
}
