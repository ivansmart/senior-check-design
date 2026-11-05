/// <reference types="@figma/plugin-typings" />
/**
 * Aperçu avant / après : on clone la racine d'aperçu, on la déplace hors écran
 * sur sa page, on applique les plans de correction sur le clone, on exporte
 * l'original et le clone en PNG, puis on supprime le clone. Le document
 * revient exactement à son état initial.
 *
 * Racines d'aperçu, par ordre de priorité : la racine demandée explicitement,
 * les éléments sélectionnés sur le canvas (si demandé), sinon les cadres
 * racines (sous la page) des calques concernés.
 */
import type { PreviewFrame, PreviewRoot, PreviewSkipped } from '../shared/types';
import { applyPlan } from './fix/apply';
import type { FixPlan } from './fix/plans';
import { nodeDepth, sortForApply } from './reattach-live';

export interface PreviewItem {
  issueId: string;
  nodeId: string;
  plan: FixPlan;
}

export interface PreviewRequest {
  items: PreviewItem[];
  maxRoots: number;
  /** Racine choisie explicitement par l'utilisateur (sélecteur du volet). */
  rootId: string | null;
  /** Rendre les éléments sélectionnés sur le canvas plutôt que les cadres concernés. */
  followSelection: boolean;
}

export interface PreviewOutput {
  frames: PreviewFrame[];
  /** Corrections non rendues (hors des racines rendues, calque disparu). */
  skipped: number;
  /** Racines disponibles pour le sélecteur : sélection d'abord, puis cadres concernés. */
  roots: PreviewRoot[];
  /** Racines refusées parce que trop lourdes à cloner et exporter. */
  tooBig: PreviewSkipped[];
}

/** Côté maximal (px image) d'un export, pour borner mémoire et temps de rendu. */
const MAX_EDGE = 1400;
/** Au-delà, cloner et exporter figerait l'éditeur. */
export const MAX_PREVIEW_NODES = 1500;
const MAX_PREVIEW_AREA = 16_000_000;
const PREVIEW_TAG = 'scd:preview-clone';
/** Décalage du clone, loin de tout contenu plausible. */
const FAR = 200000;

type Parent = BaseNode & ChildrenMixin;
type Located = { item: PreviewItem; node: SceneNode };

const isScene = (n: BaseNode | null | undefined): n is SceneNode => Boolean(n) && n!.type !== 'PAGE' && n!.type !== 'DOCUMENT';

function pageOf(node: SceneNode): PageNode | null {
  let p: BaseNode | null = node;
  while (p && p.type !== 'PAGE') p = p.parent;
  return (p as PageNode | null) ?? null;
}

/** Cadre racine par défaut : l'ancêtre direct sous la page (ou sous une section). */
function topLevelRootOf(node: SceneNode): SceneNode {
  let n: SceneNode = node;
  while (n.parent && n.parent.type !== 'PAGE' && n.parent.type !== 'DOCUMENT' && n.parent.type !== 'SECTION') n = n.parent as SceneNode;
  return n;
}

/**
 * Racine clonable : un clone ne peut pas vivre dans une instance, et cloner
 * l'enfant d'un composant principal ou une variante seule perturbe le
 * composant. On remonte donc à l'instance ou au composant le plus extérieur,
 * puis au jeu de variantes s'il y a lieu.
 */
function cloneableRoot(node: SceneNode): SceneNode {
  let root: SceneNode = node;
  let p: BaseNode | null = node.parent;
  while (p && isScene(p)) {
    if (p.type === 'INSTANCE' || p.type === 'COMPONENT') root = p;
    p = p.parent;
  }
  if (root.parent && root.parent.type === 'COMPONENT_SET') root = root.parent as SceneNode;
  return root;
}

function isWithin(node: SceneNode, root: SceneNode): boolean {
  let n: BaseNode | null = node;
  while (n && isScene(n)) {
    if (n.id === root.id) return true;
    n = n.parent;
  }
  return false;
}

/** Chemin d'indices de `root` vers `node`, pour retrouver le calque homologue dans le clone. */
function indexPath(root: SceneNode, node: SceneNode): number[] | null {
  const path: number[] = [];
  let n: SceneNode = node;
  while (n.id !== root.id) {
    const parent = n.parent as Parent | null;
    if (!parent || !('children' in parent)) return null;
    const idx = parent.children.indexOf(n);
    if (idx < 0) return null;
    path.unshift(idx);
    n = parent as unknown as SceneNode;
  }
  return path;
}

function follow(root: SceneNode, path: number[]): SceneNode | null {
  let n: SceneNode = root;
  for (const i of path) {
    if (!('children' in n)) return null;
    const child = (n as Parent).children[i];
    if (!child) return null;
    n = child;
  }
  return n;
}

function exportPng(node: SceneNode, scale: number): Promise<Uint8Array> {
  return node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
}

/** Le clone, déplacé sur la page, doit résoudre les mêmes modes de variables que l'original dans son contexte. */
async function copyResolvedModes(from: SceneNode, to: SceneNode) {
  try {
    for (const [collectionId, modeId] of Object.entries(from.resolvedVariableModes)) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
      if (collection) to.setExplicitVariableModeForCollection(collection, modeId);
    }
  } catch {
    /* collection inaccessible : on garde la résolution par défaut */
  }
}

/** Éléments sélectionnés, sans ceux imbriqués dans un autre élément sélectionné, ramenés à une racine clonable. */
function selectionRoots(): SceneNode[] {
  const selection = figma.currentPage.selection;
  const ids = new Set(selection.map((n) => n.id));
  const out: SceneNode[] = [];
  const seen = new Set<string>();
  for (const node of selection) {
    let nested = false;
    let p: BaseNode | null = node.parent;
    while (p && isScene(p)) {
      if (ids.has(p.id)) {
        nested = true;
        break;
      }
      p = p.parent;
    }
    if (nested) continue;
    const root = cloneableRoot(node);
    if (seen.has(root.id)) continue;
    seen.add(root.id);
    out.push(root);
  }
  return out;
}

const COUNT_TYPES: NodeType[] = ['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'VECTOR', 'LINE', 'TEXT', 'BOOLEAN_OPERATION', 'SECTION', 'SLICE'];

/** Nombre de calques d'un cadre (lui compris), via l'index natif par type. */
function nodeCount(root: SceneNode): number {
  return 'findAllWithCriteria' in root ? (root as SceneNode & ChildrenMixin).findAllWithCriteria({ types: COUNT_TYPES }).length + 1 : 1;
}

type RenderResult = { frame?: PreviewFrame; tooBig?: PreviewSkipped };

async function renderRoot(root: SceneNode, located: Located[]): Promise<RenderResult> {
  if (!('width' in root) || root.width <= 0 || root.height <= 0) return {};
  const page = pageOf(root);
  if (!page) return {};
  // Cloner et exporter un cadre énorme bloquerait l'éditeur : on refuse au-delà des bornes.
  const nodes = nodeCount(root);
  if (nodes > MAX_PREVIEW_NODES || root.width * root.height > MAX_PREVIEW_AREA) return { tooBig: { id: root.id, name: root.name, nodes } };
  const inside = located.filter(({ node }) => isWithin(node, root));
  const scale = Math.min(4, MAX_EDGE / Math.max(root.width, root.height));
  const before = await exportPng(root, scale);
  let holder: FrameNode | null = null;
  let applied = 0;
  let failed = 0;
  try {
    // Même ordre que l'application réelle : valeurs d'abord, puis rattachements du plus profond au moins profond.
    const paths = sortForApply(inside, ({ item, node }) => ({ reattach: item.plan.kind === 'reattach-instance', depth: nodeDepth(node) })).map(({ item, node }) => ({ item, path: indexPath(root, node) }));
    // Le clone vit dans un cadre d'accueil : quand une correction remplace le clone lui-même (rattachement du cadre
    // sélectionné), c'est l'accueil qui est exporté, puis supprimé avec tout ce qui a été créé dedans.
    holder = figma.createFrame();
    holder.setPluginData(PREVIEW_TAG, '1');
    holder.name = `${root.name} (aperçu)`;
    holder.fills = [];
    holder.strokes = [];
    holder.clipsContent = false;
    page.appendChild(holder);
    holder.x = FAR;
    holder.y = FAR;
    holder.resizeWithoutConstraints(root.width, root.height);
    const clone = root.clone();
    clone.name = root.name;
    holder.appendChild(clone);
    clone.x = 0;
    clone.y = 0;
    await copyResolvedModes(root, clone);
    holder.locked = true;
    for (const { item, path } of paths) {
      const target = path && !clone.removed ? follow(clone, path) : null;
      if (!target) {
        failed++;
        continue;
      }
      try {
        await applyPlan(item.issueId, { ...item.plan, nodeId: target.id } as FixPlan);
        applied++;
      } catch {
        failed++;
      }
    }
    const after = await exportPng(holder, scale);
    return { frame: { rootId: root.id, name: root.name, width: root.width, height: root.height, scale, before, after, applied, failed, issueIds: inside.map((g) => g.item.issueId) } };
  } finally {
    if (holder && !holder.removed) holder.remove();
  }
}

export async function renderPreview(req: PreviewRequest): Promise<PreviewOutput> {
  const located: Located[] = [];
  for (const item of req.items) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!isScene(node) || node.removed) continue;
    located.push({ item, node });
  }
  const countIn = (root: SceneNode) => located.filter(({ node }) => isWithin(node, root)).length;
  const byCount = (a: SceneNode, b: SceneNode) => countIn(b) - countIn(a);

  // Racines candidates : sélection (si suivie ou si une racine explicite est demandée), puis cadres concernés.
  const selected = req.followSelection || req.rootId ? selectionRoots() : [];
  const selectedIds = new Set(selected.map((r) => r.id));
  const frameRoots = new Map<string, SceneNode>();
  for (const { node } of located) {
    const root = cloneableRoot(topLevelRootOf(node));
    if (!selectedIds.has(root.id)) frameRoots.set(root.id, root);
  }
  const frames = [...frameRoots.values()].sort(byCount);
  const roots: PreviewRoot[] = [
    ...selected.map((r) => ({ id: r.id, name: r.name, count: countIn(r), kind: 'selection' as const })),
    ...frames.map((r) => ({ id: r.id, name: r.name, count: countIn(r), kind: 'frame' as const })),
  ];

  // Racines à rendre.
  let toRender: SceneNode[];
  if (req.rootId) {
    let root = selected.find((r) => r.id === req.rootId) ?? frameRoots.get(req.rootId) ?? null;
    if (!root) {
      const node = await figma.getNodeByIdAsync(req.rootId);
      if (isScene(node) && !node.removed) root = cloneableRoot(node);
    }
    toRender = root ? [root] : [];
  } else if (req.followSelection && selected.length) {
    toRender = [...selected].sort(byCount).slice(0, req.maxRoots);
  } else {
    toRender = frames.slice(0, req.maxRoots);
  }

  const out: PreviewFrame[] = [];
  const tooBig: PreviewSkipped[] = [];
  let rendered = 0;
  for (const root of toRender) {
    const result = await renderRoot(root, located);
    if (result.tooBig) tooBig.push(result.tooBig);
    if (!result.frame) continue;
    out.push(result.frame);
    rendered += result.frame.issueIds.length;
  }
  return { frames: out, skipped: Math.max(0, located.length - rendered), roots, tooBig };
}

/** Sécurité : supprime d'éventuels clones d'aperçu orphelins (plugin interrompu) sur la page courante. */
export function sweepPreviewClones(): number {
  let removed = 0;
  const visit = (nodes: readonly SceneNode[]) => {
    for (const n of nodes) {
      if (n.getPluginData(PREVIEW_TAG)) {
        n.remove();
        removed++;
      } else if (n.type === 'SECTION') visit(n.children);
    }
  };
  visit(figma.currentPage.children);
  return removed;
}
