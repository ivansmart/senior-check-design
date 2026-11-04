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

// ---------------------------------------------------------------------------
// Heuristiques Pro (V2) : tokens, composants, craft, accessibilité
// ---------------------------------------------------------------------------

/** Token « primitif » : palette brute (blue/500, gray-100, neutral.900…). */
const PRIMITIVE_TOKEN_RE =
  /(^|\/|\.)(blue|red|green|gray|grey|neutral|orange|yellow|purple|violet|pink|teal|cyan|indigo|slate|zinc|stone|amber|lime|emerald|sky|rose|fuchsia|brown|black|white|magenta|mint)[-_/. ]?(\d{1,4}|lightest|lighter|light|dark|darker|darkest|base)$/i;
const PRIMITIVE_COLLECTION_RE = /primitive|core|base|palette|raw|foundation|global/i;
/** Token « sémantique » : rôle d'usage plutôt que valeur. */
const SEMANTIC_TOKEN_RE =
  /(^|\/|\.|-|_)(action|brand|text|surface|background|bg|border|stroke|icon|fg|foreground|accent|success|danger|error|warning|info|link|interactive|disabled|muted|inverse|overlay|focus|on)(\/|\.|-|_|$)/i;

export function looksPrimitiveToken(name: string, collection = ''): boolean {
  if (SEMANTIC_TOKEN_RE.test(name)) return false;
  return PRIMITIVE_TOKEN_RE.test(name) || PRIMITIVE_COLLECTION_RE.test(collection);
}

export function looksSemanticToken(name: string): boolean {
  return SEMANTIC_TOKEN_RE.test(name);
}

export const DEPRECATED_RE = /\b(deprecated|obsolete|legacy|do not use|don['’]t use|ne pas utiliser|obsol[eè]te|à supprimer)\b|⚠️|⚠|🚫|❌|☠️/i;

export const STATUS_RE = /\b(draft|wip|work in progress|beta|alpha|stable|deprecated|ready|in review|experimental|brouillon|validé|valide)\b|🟢|🟡|🟠|🔴|✅|🚧|🧪/i;

export const DESTRUCTIVE_RE =
  /\b(delete|remove|supprimer|effacer|trash|retirer|destroy|clear all|tout effacer|unsubscribe|désinscrire|desinscrire|deactivate|désactiver|desactiver|close account|fermer le compte|reset|réinitialiser|reinitialiser|discard|abandonner)\b/i;

export const CONFIRM_RE = /\b(confirm|confirmation|dialog|modal|alert|undo|annuler|toast|snackbar|are you sure|êtes-vous sûr|es-tu sûr|sure\?)\b/i;

export const RECOVERY_RE =
  /\b(retry|réessayer|reessayer|try again|contact|support|back|retour|help|aide|reload|recharger|refresh|actualiser|go home|accueil|réinitialiser|reinitialiser|reset)\b/i;

export const GENERIC_ERROR_RE =
  /^(erreur|error|une erreur est survenue|une erreur s['’]est produite|something went wrong|an error occurred|an error has occurred|oops!?|oups!?|échec|echec|failed|erreur inconnue|unknown error|error\s*\d{3})[.!…]*$/i;

export const ERROR_NAME_RE = /\b(error|erreur|échec|echec|failed|failure|invalid)\b/i;

export const ICON_NAME_RE = /\b(icon|icône|icone|ico|glyph|symbol|pictogram|picto)\b/i;

/** Niveau de titre déduit du nom d'un style de texte (« Heading/H2 », « Title 1 », « h3 »). */
export function headingLevel(styleName: string): number | null {
  const m = /(^|\/|\s|-|_)(h|heading|title|titre|headline|display)[\s/_-]?([1-6])\b/i.exec(styleName);
  return m ? Number(m[3]) : null;
}

export type LabelCase = 'upper' | 'title' | 'sentence' | 'lower' | 'other';

/** Casse d'un libellé court (bouton, onglet). */
export function labelCase(text: string): LabelCase {
  const words = text.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (!words.length) return 'other';
  const letters = words.join('');
  if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return 'upper';
  if (letters === letters.toLowerCase()) return 'lower';
  const startsUpper = (w: string) => /^\p{Lu}/u.test(w);
  if (words.length >= 2 && words.every((w) => startsUpper(w) || w.length <= 2)) return 'title';
  if (startsUpper(words[0]) && words.slice(1).every((w) => !startsUpper(w))) return 'sentence';
  return 'other';
}

export const LABEL_CASE_EXAMPLE: Record<LabelCase, string> = {
  upper: 'ENREGISTRER',
  title: 'Enregistrer Les Modifications',
  sentence: 'Enregistrer les modifications',
  lower: 'enregistrer',
  other: '',
};

/** Nom normalisé pour comparer des conteneurs « de même rôle » (sans numéros ni suffixes). */
export function roleName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*copy(\s*\d+)?$/i, '')
    .replace(/[\s_-]*\d+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
