/**
 * Ressemblance visuelle entre un cadre et un composant, estimée sur les propriétés
 * qui font le rendu (taille, fond, contour, rayons, mise en page, types d'enfants,
 * couleurs et polices du contenu), sans export d'image : déterministe et immédiat.
 * Pur : aucune dépendance à l'API Figma.
 */

export interface VisualSig {
  w: number;
  h: number;
  /** Largeur / hauteur ajustées au contenu (hug) : un écart de taille y est attendu. */
  hug: [boolean, boolean];
  radius: number;
  layout: string;
  /** Haut, droite, bas, gauche (0 hors auto-layout). */
  pad: [number, number, number, number];
  gap: number;
  /** '#rrggbb', 'gradient', 'image' ou null (pas de fond visible). */
  fill: string | null;
  /** '#rrggbb@épaisseur' ou null. */
  stroke: string | null;
  effects: number;
  /** Types normalisés des enfants directs visibles (TEXT, INSTANCE, FRAME, RECT, SHAPE, OTHER). */
  kinds: string[];
  /** 'famille|style|taille' des textes du sous-arbre, uniques. */
  fonts: string[];
  /** Couleurs unies du sous-arbre (hors racine), uniques. */
  colors: string[];
  nodes: number;
}

/** Score minimal pour proposer un composant. */
export const LOOKALIKE_MIN = 0.8;
/** Avance minimale sur le meilleur candidat d'une autre famille (sinon ambigu : on ne propose rien). */
export const LOOKALIKE_MARGIN = 0.04;
/** Écart de taille maximal (relatif au composant) pour envisager une ressemblance. */
export const LOOKALIKE_MAX_SIZE_DIFF = 0.25;

function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Jaccard sur multi-ensembles (deux textes comptent double). */
function multiJaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const A = count(a);
  const B = count(b);
  let inter = 0;
  let union = 0;
  for (const k of new Set([...A.keys(), ...B.keys()])) {
    const x = A.get(k) ?? 0;
    const y = B.get(k) ?? 0;
    inter += Math.min(x, y);
    union += Math.max(x, y);
  }
  return union ? inter / union : 1;
}

/** Écart de taille relatif au composant `b`, atténué sur un axe où le composant s'ajuste à son contenu. */
export function sizeDiff(a: VisualSig, b: VisualSig): number {
  const dx = (Math.abs(a.w - b.w) / Math.max(1, b.w)) * (b.hug[0] ? 0.4 : 1);
  const dy = (Math.abs(a.h - b.h) / Math.max(1, b.h)) * (b.hug[1] ? 0.4 : 1);
  return Math.max(dx, dy);
}

/** Score 0..1 : pondération des propriétés visibles. */
export function similarity(a: VisualSig, b: VisualSig): number {
  const size = 1 - Math.min(1, sizeDiff(a, b) * 2.5);
  const radius = 1 - Math.min(1, Math.abs(a.radius - b.radius) / 8);
  const fill = a.fill === b.fill ? 1 : 0;
  const stroke = a.stroke === b.stroke ? 1 : 0;
  const padClose = a.pad.every((v, i) => Math.abs(v - b.pad[i]) <= 2) && Math.abs(a.gap - b.gap) <= 2;
  const layout = a.layout === b.layout ? (a.layout === 'NONE' || padClose ? 1 : 0.6) : 0;
  const kinds = multiJaccard(a.kinds, b.kinds);
  const colors = jaccard(a.colors, b.colors);
  const fonts = jaccard(a.fonts, b.fonts);
  const effects = a.effects === b.effects ? 1 : 0.5;
  return 0.22 * size + 0.1 * radius + 0.18 * fill + 0.08 * stroke + 0.12 * layout + 0.1 * kinds + 0.1 * colors + 0.07 * fonts + 0.03 * effects;
}

/**
 * Garde-fous avant le score : taille proche, même surface (fond ou contour identique)
 * et contenu comparable, pour ne jamais apparier deux conteneurs quelconques.
 */
export function plausible(a: VisualSig, b: VisualSig): boolean {
  if (sizeDiff(a, b) > LOOKALIKE_MAX_SIZE_DIFF) return false;
  const surface = (a.fill !== null && a.fill === b.fill) || (a.stroke !== null && a.stroke === b.stroke);
  if (!surface) return false;
  const content = (multiJaccard(a.kinds, b.kinds) + jaccard(a.colors, b.colors) + jaccard(a.fonts, b.fonts)) / 3;
  return content >= 0.5;
}

export interface LookalikeCandidate<T> {
  sig: VisualSig;
  /** Famille (jeu de variantes) : deux variantes du même jeu ne se concurrencent pas. */
  family: string;
  item: T;
}

export interface LookalikeMatch<T> {
  item: T;
  score: number;
  /** Meilleurs candidats d'autres familles à score quasi égal : proposés en alternative, au choix de l'utilisateur. */
  alternatives: { item: T; score: number }[];
}

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1));

/** Mots communs entre deux noms (« Button / Pay » et « button pay copy » : 2). Départage les candidats à score égal. */
export function nameOverlap(a: string, b: string): number {
  const A = tokens(a);
  let n = 0;
  for (const t of tokens(b)) if (A.has(t)) n++;
  return n;
}

/**
 * Meilleur candidat plausible par famille (score ≥ LOOKALIKE_MIN). À score égal, le nom le plus proche
 * l'emporte, puis l'ordre du document. Les autres familles à moins de LOOKALIKE_MARGIN restent en alternative.
 */
export function bestLookalike<T>(sig: VisualSig, candidates: LookalikeCandidate<T>[], prefer: (item: T) => number = () => 0): LookalikeMatch<T> | null {
  const byFamily = new Map<string, { c: LookalikeCandidate<T>; s: number }>();
  for (const c of candidates) {
    if (!plausible(sig, c.sig)) continue;
    const s = similarity(sig, c.sig);
    if (s < LOOKALIKE_MIN) continue;
    const cur = byFamily.get(c.family);
    if (!cur || s > cur.s || (s === cur.s && prefer(c.item) > prefer(cur.c.item))) byFamily.set(c.family, { c, s });
  }
  const ranked = [...byFamily.values()].sort((a, b) => b.s - a.s || prefer(b.c.item) - prefer(a.c.item));
  if (!ranked.length) return null;
  const best = ranked[0];
  const alternatives = ranked
    .slice(1)
    .filter((x) => best.s - x.s <= LOOKALIKE_MARGIN)
    .slice(0, 3)
    .map((x) => ({ item: x.c.item, score: x.s }));
  return { item: best.c.item, score: best.s, alternatives };
}
