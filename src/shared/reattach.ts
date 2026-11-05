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
  /** Clés visuelles (voir paint-key) : si elles sont égales, aucun override même quand le JSON diffère (token lié ou non). */
  fillsVisual?: string;
  strokesVisual?: string;
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
  /** `tree` : appariement par structure ; `content` : appariement des feuilles par ordre de lecture (structures différentes). */
  mode?: 'tree' | 'content';
  overrides: OverrideOp[];
  /** Calques du détaché sans équivalent dans le composant (chemins dans l'arbre détaché) : conservés au-dessus de l'instance en mode forcé. */
  extras: number[][];
  /** Motifs d'échec (codes stables) : added:<name>, mixed-font:<name>, mixed-paint:<name>, swap-remote:<name>. */
  reasons: string[];
  stats: { matched: number; hidden: number; texts: number; added: number };
}

const norm = (s: string) => s.trim().toLowerCase();

/** Peintures différentes à l'écran : clés JSON différentes et, quand elles existent, clés visuelles différentes. */
const paintsDiffer = (dKey?: string, cKey?: string, dVisual?: string, cVisual?: string) =>
  dKey !== undefined && cKey !== undefined && dKey !== cKey && (dVisual === undefined || cVisual === undefined || dVisual !== cVisual);

const WRAPPERS = new Set(['FRAME', 'GROUP']);
const paintless = (node: TreeNode) =>
  !(node.fills ?? []).some((p) => (p as { visible?: boolean }).visible !== false) && !(node.strokes ?? []).some((p) => (p as { visible?: boolean }).visible !== false);

/**
 * Texte unique d'un sous-arbre fait seulement de conteneurs sans peinture (cadre d'habillage),
 * avec son chemin : une copie à la main pose souvent le libellé dans un cadre intermédiaire.
 */
function soleText(node: TreeNode, depth = 0): { node: TreeNode; path: number[] } | null {
  if (depth > 3 || !WRAPPERS.has(node.type) || !paintless(node)) return null;
  let found: { node: TreeNode; path: number[] } | null = null;
  for (let i = 0; i < node.children.length; i++) {
    const ch = node.children[i];
    if (!ch.visible) continue;
    let hit: { node: TreeNode; path: number[] } | null = null;
    if (ch.type === 'TEXT') hit = { node: ch, path: [i] };
    else if (WRAPPERS.has(ch.type)) {
      const inner = soleText(ch, depth + 1);
      if (!inner) return null;
      hit = { node: inner.node, path: [i, ...inner.path] };
    } else return null; // autre contenu visible : ce n'est pas un simple habillage
    if (found) return null; // deux textes
    found = hit;
  }
  return found;
}

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
    // 3. habillage : le texte du composant est posé dans un cadre vide du détaché, ou l'inverse
    //    (copie à la main) ; on apparie les textes et le cadre n'est plus un ajout.
    if (dj < 0) {
      let handled = false;
      if (c.type === 'TEXT') {
        for (let j = cursor; j < detached.length && !handled; j++) {
          if (used.has(j)) continue;
          const sole = soleText(detached[j]);
          if (!sole) continue;
          used.add(j);
          cursor = j + 1;
          matchNode(sole.node, c, childPath, [...dPath, j, ...sole.path], out);
          handled = true;
        }
      } else {
        const cs = soleText(c);
        for (let j = cursor; cs && j < detached.length && !handled; j++) {
          if (used.has(j)) continue;
          const d = detached[j];
          const dt = d.type === 'TEXT' ? { node: d, path: [] as number[] } : soleText(d);
          if (!dt) continue;
          used.add(j);
          cursor = j + 1;
          matchNode(dt.node, cs.node, [...childPath, ...cs.path], [...dPath, j, ...dt.path], out);
          handled = true;
        }
      }
      if (handled) continue;
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
  if (paintsDiffer(d.fillsKey, c.fillsKey, d.fillsVisual, c.fillsVisual)) {
    if (d.fillsKey === 'mixed' || !d.fills) out.reasons.push(`mixed-paint:${d.name}`);
    else out.overrides.push({ path, op: 'fills', value: d.fills });
  }
  if (paintsDiffer(d.strokesKey, c.strokesKey, d.strokesVisual, c.strokesVisual)) {
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
  if (paintsDiffer(detached.fillsKey, component.fillsKey, detached.fillsVisual, component.fillsVisual)) {
    if (detached.fillsKey === 'mixed' || !detached.fills) out.reasons.push(`mixed-paint:${detached.name}`);
    else out.overrides.push({ path: [], op: 'fills', value: detached.fills });
  }
  if (paintsDiffer(detached.strokesKey, component.strokesKey, detached.strokesVisual, component.strokesVisual)) {
    if (detached.strokesKey === 'mixed' || !detached.strokes) out.reasons.push(`mixed-paint:${detached.name}`);
    else out.overrides.push({ path: [], op: 'strokes', value: detached.strokes });
  }
  matchChildren(detached.children, component.children, [], [], out);
  out.ok = out.reasons.length === 0;
  return out;
}

/**
 * Coût d'un rattachement forcé (plus petit = plus fidèle) : les calques à conserver au-dessus
 * pèsent plus que les motifs, qui pèsent plus que les calques masqués, qui pèsent plus que les overrides.
 */
export function forcedCost(result: MatchResult): number {
  return result.extras.length * 5 + result.reasons.length * 3 + result.stats.hidden * 2 + result.overrides.length;
}

// ---------------------------------------------------------------------------
// Appariement par contenu : feuilles en ordre de lecture, quelles que soient les imbrications.
// Une copie à la main (ou un détaché très retravaillé) garde en général les mêmes textes,
// images et icônes, dans le même ordre, mais pas les mêmes cadres intermédiaires.
// ---------------------------------------------------------------------------

type LeafKind = 'TEXT' | 'ICON' | 'IMAGE' | 'SHAPE' | 'BOX' | 'INSTANCE';

interface Leaf {
  node: TreeNode;
  path: number[];
  kind: LeafKind;
  /** TEXT : taille (arrondie à 2 px) et graisse, pour préférer les textes de même rôle. */
  role: string;
}

const SHAPE_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'STAR', 'POLYGON', 'ELLIPSE', 'RECTANGLE']);
const MAX_LEAVES = 200;
const MAX_LEAF_DEPTH = 8;

const hasImage = (n: TreeNode) => (n.fills ?? []).some((p) => (p as { type?: string; visible?: boolean }).type === 'IMAGE' && (p as { visible?: boolean }).visible !== false);
const painted = (n: TreeNode) => (n.fills ?? []).some((p) => (p as { visible?: boolean }).visible !== false) || (n.strokes ?? []).some((p) => (p as { visible?: boolean }).visible !== false);

/** Vrai si tous les descendants visibles sont des formes (une icône vectorielle), avec au moins une forme. */
function allShapes(n: TreeNode, depth = 0): boolean {
  if (depth > 4) return false;
  let any = false;
  for (const c of n.children) {
    if (!c.visible) continue;
    if (SHAPE_TYPES.has(c.type) && !hasImage(c)) {
      any = true;
      continue;
    }
    if (c.children.length && allShapes(c, depth + 1)) {
      any = true;
      continue;
    }
    return false;
  }
  return any;
}

const textRole = (n: TreeNode) => {
  const size = typeof n.fontSize === 'number' ? Math.round(n.fontSize / 2) * 2 : 0;
  const style = n.fontName && n.fontName !== 'mixed' ? n.fontName.style : '';
  return `${size}|${/bold|semi|medium|black|heavy|extra/i.test(style) ? 'b' : 'r'}`;
};

export function collectLeaves(root: TreeNode, path: number[] = [], out: Leaf[] = [], depth = 0): Leaf[] {
  for (let i = 0; i < root.children.length && out.length < MAX_LEAVES; i++) {
    const c = root.children[i];
    if (!c.visible) continue;
    const p = [...path, i];
    if (c.type === 'TEXT') out.push({ node: c, path: p, kind: 'TEXT', role: textRole(c) });
    else if (hasImage(c)) out.push({ node: c, path: p, kind: 'IMAGE', role: '' });
    else if (SHAPE_TYPES.has(c.type)) out.push({ node: c, path: p, kind: 'SHAPE', role: '' });
    else if (c.children.length) {
      if (allShapes(c)) out.push({ node: c, path: p, kind: 'ICON', role: '' });
      else if (depth < MAX_LEAF_DEPTH) collectLeaves(c, p, out, depth + 1);
    } else if (c.type === 'INSTANCE') out.push({ node: c, path: p, kind: 'INSTANCE', role: '' });
    else if (painted(c)) out.push({ node: c, path: p, kind: 'BOX', role: '' });
  }
  return out;
}

const MEDIA = new Set<LeafKind>(['ICON', 'IMAGE', 'SHAPE', 'BOX', 'INSTANCE']);

function pairScore(d: Leaf, c: Leaf): number {
  if (d.kind !== c.kind) {
    // Deux médias de natures différentes (image à la place d'une icône) : apparentés par la place,
    // le média du détaché sera conservé au-dessus de celui du composant, qui garde sa place dans la mise en page.
    return MEDIA.has(d.kind) && MEDIA.has(c.kind) ? 0.5 : 0;
  }
  switch (d.kind) {
    case 'TEXT':
      return d.role === c.role ? 1 : 0.6;
    case 'SHAPE':
    case 'BOX':
      return 0.7;
    default:
      return 1;
  }
}

/** Alignement optimal (programmation dynamique, type LCS pondéré) des feuilles détachées sur celles du composant. */
function align(D: Leaf[], C: Leaf[]): [Leaf, Leaf][] {
  const m = D.length;
  const n = C.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const s = pairScore(D[i - 1], C[j - 1]);
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], s > 0 ? dp[i - 1][j - 1] + s : 0);
    }
  }
  const pairs: [Leaf, Leaf][] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const s = pairScore(D[i - 1], C[j - 1]);
    if (s > 0 && dp[i][j] === dp[i - 1][j - 1] + s) {
      pairs.push([D[i - 1], C[j - 1]]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return pairs.reverse();
}

/**
 * Apparie le contenu du détaché avec celui du composant feuille à feuille, en ordre de lecture.
 * Les textes appariés sont reportés (le style du composant l'emporte), les images et formes aussi ;
 * les feuilles du composant sans équivalent sont masquées, celles du détaché sans équivalent sont
 * conservées au-dessus (mode forcé). Toujours « forcé » : la structure n'est pas celle du composant.
 */
export function matchByContent(detached: TreeNode, component: TreeNode): MatchResult {
  const out: MatchResult = { ok: false, mode: 'content', overrides: [], extras: [], reasons: [], stats: { matched: 0, hidden: 0, texts: 0, added: 0 } };
  if (Math.abs(detached.opacity - component.opacity) > 0.001) out.overrides.push({ path: [], op: 'opacity', value: detached.opacity });
  if (paintsDiffer(detached.fillsKey, component.fillsKey, detached.fillsVisual, component.fillsVisual) && detached.fills && detached.fillsKey !== 'mixed') out.overrides.push({ path: [], op: 'fills', value: detached.fills });
  if (paintsDiffer(detached.strokesKey, component.strokesKey, detached.strokesVisual, component.strokesVisual) && detached.strokes && detached.strokesKey !== 'mixed') out.overrides.push({ path: [], op: 'strokes', value: detached.strokes });
  const D = collectLeaves(detached);
  const C = collectLeaves(component);
  const pairs = align(D, C);
  const usedD = new Set<Leaf>();
  const usedC = new Set<Leaf>();
  for (const [d, c] of pairs) {
    usedD.add(d);
    usedC.add(c);
    out.stats.matched++;
    if (d.kind !== c.kind) {
      // Média de nature différente : non reproductible dans l'instance, conservé au-dessus (le média du composant reste visible dessous).
      out.stats.added++;
      out.reasons.push(`added:${d.node.name}`);
      out.extras.push(d.path);
      continue;
    }
    if (d.kind === 'TEXT') {
      if ((d.node.text ?? '') !== (c.node.text ?? '')) {
        out.overrides.push({ path: c.path, op: 'text', value: d.node.text ?? '' });
        out.stats.texts++;
      }
    } else if (d.kind === 'ICON' || d.kind === 'INSTANCE') {
      if (d.node.type === 'INSTANCE' && c.node.type === 'INSTANCE' && d.node.mainId !== undefined && c.node.mainId !== undefined && d.node.mainId !== c.node.mainId) {
        if (d.node.mainId && !d.node.mainRemote) out.overrides.push({ path: c.path, op: 'swap', componentId: d.node.mainId });
        else if (d.node.mainKey) out.overrides.push({ path: c.path, op: 'swap', componentKey: d.node.mainKey });
      }
    } else {
      if (paintsDiffer(d.node.fillsKey, c.node.fillsKey, d.node.fillsVisual, c.node.fillsVisual) && d.node.fills && d.node.fillsKey !== 'mixed') out.overrides.push({ path: c.path, op: 'fills', value: d.node.fills });
      if (paintsDiffer(d.node.strokesKey, c.node.strokesKey, d.node.strokesVisual, c.node.strokesVisual) && d.node.strokes && d.node.strokesKey !== 'mixed') out.overrides.push({ path: c.path, op: 'strokes', value: d.node.strokes });
    }
  }
  for (const c of C) {
    if (usedC.has(c)) continue;
    out.overrides.push({ path: c.path, op: 'visible', value: false });
    out.stats.hidden++;
  }
  for (const d of D) {
    if (usedD.has(d)) continue;
    out.stats.added++;
    out.reasons.push(`added:${d.node.name}`);
    out.extras.push(d.path);
  }
  return out;
}

/** Meilleur appariement : par structure quand il est fidèle, sinon le moins coûteux entre structure et contenu. */
export function matchBest(detached: TreeNode, component: TreeNode): MatchResult {
  const tree = matchTrees(detached, component);
  tree.mode = 'tree';
  if (tree.ok) return tree;
  const content = matchByContent(detached, component);
  return forcedCost(content) < forcedCost(tree) ? content : tree;
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
