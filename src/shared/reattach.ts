/**
 * Rattachement d'une instance détachée (Pro).
 *
 * On compare l'arbre du calque détaché avec celui d'une variante du composant
 * d'origine. Le rattachement n'est proposé que si une instance de cette
 * variante peut reproduire le contenu détaché uniquement par des overrides
 * d'instance (texte, visibilité, nom, opacité, couleurs, police, style de
 * texte, échange d'instance imbriquée). Un calque ajouté à la main, un type
 * différent ou une police mixte rendent le rattachement impossible : on le
 * dit, plutôt que de produire une instance à retoucher.
 *
 * Ce module ne dépend ni de l'API Figma ni du DOM : il est testé à part.
 */

export interface TreeNode {
  type: string;
  name: string;
  visible: boolean;
  opacity: number;
  /** TEXT : contenu. */
  text?: string;
  /** TEXT : police et taille, ou 'mixed'. */
  fontName?: { family: string; style: string } | 'mixed';
  fontSize?: number | 'mixed';
  textStyleId?: string | 'mixed';
  /** Clés de comparaison des remplissages et contours (JSON), 'mixed' si illisibles. */
  fillsKey?: string;
  strokesKey?: string;
  /** Valeurs brutes à reporter (sérialisables). */
  fills?: unknown[];
  strokes?: unknown[];
  /** INSTANCE : composant principal (id local) ; null si inaccessible. */
  mainId?: string | null;
  mainRemote?: boolean;
  /** INSTANCE distante : clé de librairie, pour un échange par import. */
  mainKey?: string;
  children: TreeNode[];
}

export type OverrideOp =
  | { path: number[]; op: 'text'; value: string }
  | { path: number[]; op: 'visible'; value: boolean }
  | { path: number[]; op: 'name'; value: string }
  | { path: number[]; op: 'opacity'; value: number }
  | { path: number[]; op: 'fills'; value: unknown[] }
  | { path: number[]; op: 'strokes'; value: unknown[] }
  | { path: number[]; op: 'font'; fontName: { family: string; style: string }; fontSize: number }
  | { path: number[]; op: 'textStyle'; styleId: string }
  | { path: number[]; op: 'swap'; componentId?: string; componentKey?: string };

export interface MatchResult {
  /** Reproduction fidèle possible par overrides seuls. */
  ok: boolean;
  overrides: OverrideOp[];
  /** Calques du détaché sans équivalent dans le composant (chemins dans l'arbre détaché) : conservés au-dessus de l'instance en mode forcé. */
  extras: number[][];
  /** Motifs d'échec (codes stables) : added:<name>, mixed-font:<name>, mixed-paint:<name>, swap-remote:<name>. */
  reasons: string[];
  stats: { matched: number; hidden: number; texts: number; added: number };
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Apparie les enfants du composant (ordre de référence) avec ceux du calque détaché.
 * Un enfant du composant absent du détaché sera masqué ; un enfant du détaché absent
 * du composant est un ajout : impossible dans une instance.
 */
function matchChildren(detached: TreeNode[], component: TreeNode[], path: number[], dPath: number[], out: MatchResult): void {
  const used = new Set<number>();
  let cursor = 0;
  for (let ci = 0; ci < component.length; ci++) {
    const c = component[ci];
    const childPath = [...path, ci];
    // 1. même type et même nom, à partir du curseur
    let dj = -1;
    for (let j = cursor; j < detached.length; j++) {
      if (used.has(j)) continue;
      if (detached[j].type === c.type && norm(detached[j].name) === norm(c.name)) {
        dj = j;
        break;
      }
    }
    // 2. sinon, le prochain enfant libre de même type dont le nom ne correspond à aucun autre enfant du composant (renommage)
    if (dj < 0) {
      for (let j = cursor; j < detached.length; j++) {
        if (used.has(j) || detached[j].type !== c.type) continue;
        const nameBelongsElsewhere = component.some((o, oi) => oi !== ci && o.type === detached[j].type && norm(o.name) === norm(detached[j].name));
        if (!nameBelongsElsewhere) {
          dj = j;
          break;
        }
      }
    }
    if (dj < 0) {
      // Enfant du composant sans équivalent : on le masque dans l'instance (sauf s'il l'est déjà).
      if (c.visible) out.overrides.push({ path: childPath, op: 'visible', value: false });
      out.stats.hidden++;
      continue;
    }
    used.add(dj);
    cursor = dj + 1;
    matchNode(detached[dj], c, childPath, [...dPath, dj], out);
  }
  for (let j = 0; j < detached.length; j++) {
    if (used.has(j)) continue;
    out.stats.added++;
    out.reasons.push(`added:${detached[j].name}`);
    out.extras.push([...dPath, j]);
  }
}

function matchNode(d: TreeNode, c: TreeNode, path: number[], dPath: number[], out: MatchResult): void {
  out.stats.matched++;
  if (norm(d.name) !== norm(c.name)) out.overrides.push({ path, op: 'name', value: d.name });
  if (d.visible !== c.visible) out.overrides.push({ path, op: 'visible', value: d.visible });
  if (Math.abs(d.opacity - c.opacity) > 0.001) out.overrides.push({ path, op: 'opacity', value: d.opacity });
  if (d.type === 'TEXT') {
    if (d.fontName === 'mixed' || d.fontSize === 'mixed' || d.textStyleId === 'mixed') {
      // Styles mixtes non reproductibles ; en mode forcé le texte seul est reporté.
      out.reasons.push(`mixed-font:${d.name}`);
      if ((d.text ?? '') !== (c.text ?? '')) {
        out.overrides.push({ path, op: 'text', value: d.text ?? '' });
        out.stats.texts++;
      }
    } else {
      if ((d.text ?? '') !== (c.text ?? '')) {
        out.overrides.push({ path, op: 'text', value: d.text ?? '' });
        out.stats.texts++;
      }
      if (d.textStyleId && d.textStyleId !== c.textStyleId) out.overrides.push({ path, op: 'textStyle', styleId: d.textStyleId });
      else if (!d.textStyleId && d.fontName && typeof d.fontSize === 'number' && (fontKey(d.fontName) !== fontKey(c.fontName) || d.fontSize !== c.fontSize)) {
        out.overrides.push({ path, op: 'font', fontName: d.fontName, fontSize: d.fontSize });
      }
    }
  }
  if (d.fillsKey !== undefined && c.fillsKey !== undefined && d.fillsKey !== c.fillsKey) {
    if (d.fillsKey === 'mixed' || !d.fills) out.reasons.push(`mixed-paint:${d.name}`);
    else out.overrides.push({ path, op: 'fills', value: d.fills });
  }
  if (d.strokesKey !== undefined && c.strokesKey !== undefined && d.strokesKey !== c.strokesKey) {
    if (d.strokesKey === 'mixed' || !d.strokes) out.reasons.push(`mixed-paint:${d.name}`);
    else out.overrides.push({ path, op: 'strokes', value: d.strokes });
  }
  if (d.type === 'INSTANCE' && c.type === 'INSTANCE' && d.mainId !== undefined && c.mainId !== undefined && d.mainId !== c.mainId) {
    if (d.mainId && !d.mainRemote) out.overrides.push({ path, op: 'swap', componentId: d.mainId });
    else if (d.mainKey) out.overrides.push({ path, op: 'swap', componentKey: d.mainKey });
    else out.reasons.push(`swap-remote:${d.name}`);
  }
  if (d.children.length || c.children.length) matchChildren(d.children, c.children, path, dPath, out);
}

const fontKey = (f: TreeNode['fontName']) => (f && f !== 'mixed' ? `${f.family}|${f.style}` : String(f));

/**
 * Compare un calque détaché (racine FRAME) avec une variante (racine COMPONENT).
 * Pour la racine, seuls remplissages, contours et opacité sont comparés (le nom et la
 * géométrie sont recopiés sur l'instance au rattachement).
 */
export function matchTrees(detached: TreeNode, component: TreeNode): MatchResult {
  const out: MatchResult = { ok: true, overrides: [], extras: [], reasons: [], stats: { matched: 0, hidden: 0, texts: 0, added: 0 } };
  if (Math.abs(detached.opacity - component.opacity) > 0.001) out.overrides.push({ path: [], op: 'opacity', value: detached.opacity });
  if (detached.fillsKey !== undefined && component.fillsKey !== undefined && detached.fillsKey !== component.fillsKey) {
    if (detached.fillsKey === 'mixed' || !detached.fills) out.reasons.push(`mixed-paint:${detached.name}`);
    else out.overrides.push({ path: [], op: 'fills', value: detached.fills });
  }
  if (detached.strokesKey !== undefined && component.strokesKey !== undefined && detached.strokesKey !== component.strokesKey) {
    if (detached.strokesKey === 'mixed' || !detached.strokes) out.reasons.push(`mixed-paint:${detached.name}`);
    else out.overrides.push({ path: [], op: 'strokes', value: detached.strokes });
  }
  matchChildren(detached.children, component.children, [], [], out);
  out.ok = out.reasons.length === 0;
  return out;
}

/**
 * Coût d'un rattachement forcé (plus petit = plus fidèle) : les calques à conserver au-dessus
 * pèsent plus que les motifs, qui pèsent plus que les overrides.
 */
export function forcedCost(result: MatchResult): number {
  return result.extras.length * 5 + result.reasons.length * 3 + result.overrides.length;
}

/** Résumé lisible d'un résultat pour les messages : compte par type d'override. */
export function summarizeOverrides(result: MatchResult): { texts: number; visibility: number; paints: number; other: number } {
  let texts = 0;
  let visibility = 0;
  let paints = 0;
  let other = 0;
  for (const o of result.overrides) {
    if (o.op === 'text') texts++;
    else if (o.op === 'visible') visibility++;
    else if (o.op === 'fills' || o.op === 'strokes') paints++;
    else other++;
  }
  return { texts, visibility, paints, other };
}
