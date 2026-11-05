/// <reference types="@figma/plugin-typings" />
/**
 * Rattachement d'instances : partie liée à l'API Figma, partagée entre les règles
 * (détection) et l'application des corrections (recalcul sur l'état courant).
 */
import { visualPaintKey } from '../shared/paint-key';
import type { MatchResult, TreeNode } from '../shared/reattach';
import type { FixPlan } from './fix/plans';
import type { ScanContext } from './scan/context';

/** Bornes de l'arbre comparé pour le rattachement (profondeur et nombre de calques). */
export const TREE_MAX_DEPTH = 6;
export const TREE_MAX_NODES = 400;
/** Au-delà, le détaché n'a plus grand-chose du composant : on reste manuel. */
export const MAX_FORCED_EXTRAS = 12;

const cloneJson = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export const newBudget = () => ({ left: TREE_MAX_NODES });

/** Arbre sérialisable d'un calque, borné, pour la comparaison détaché / variante. */
export async function toTree(node: SceneNode, depth: number, budget: { left: number }): Promise<TreeNode> {
  budget.left--;
  const t: TreeNode = { type: node.type, name: node.name, visible: node.visible, opacity: 'opacity' in node ? (node as BlendMixin).opacity : 1, children: [] };
  if (node.type === 'TEXT') {
    t.text = node.characters;
    t.fontName = node.fontName === figma.mixed ? 'mixed' : node.fontName;
    t.fontSize = node.fontSize === figma.mixed ? 'mixed' : node.fontSize;
    t.textStyleId = node.textStyleId === figma.mixed ? 'mixed' : node.textStyleId;
  }
  if ('fills' in node) {
    const fills = (node as GeometryMixin).fills;
    if (fills === figma.mixed) t.fillsKey = 'mixed';
    else {
      t.fills = cloneJson(fills as readonly Paint[]) as unknown[];
      t.fillsKey = JSON.stringify(t.fills);
      t.fillsVisual = visualPaintKey(t.fills);
    }
  }
  if ('strokes' in node) {
    const strokes = (node as GeometryMixin).strokes;
    t.strokes = cloneJson(strokes as readonly Paint[]) as unknown[];
    t.strokesKey = JSON.stringify(t.strokes);
    t.strokesVisual = visualPaintKey(t.strokes);
  }
  if (node.type === 'INSTANCE') {
    try {
      const main = await node.getMainComponentAsync();
      t.mainId = main?.id ?? null;
      t.mainRemote = main?.remote ?? false;
      if (main?.remote) t.mainKey = main.key;
    } catch {
      t.mainId = null;
    }
  }
  if ('children' in node && depth < TREE_MAX_DEPTH) {
    for (const child of (node as SceneNode & ChildrenMixin).children) {
      if (budget.left <= 0) break;
      t.children.push(await toTree(child, depth + 1, budget));
    }
  }
  return t;
}

/**
 * Arbre d'un composant candidat, calculé une fois par analyse : vingt détachés d'un même bouton
 * comparés à quarante variantes ne lisent plus huit cents fois les mêmes calques.
 */
export async function componentTree(ctx: ScanContext, comp: ComponentNode): Promise<TreeNode> {
  const cached = ctx.componentTrees.get(comp.id);
  if (cached) return cached;
  const tree = await toTree(comp, 0, newBudget());
  ctx.componentTrees.set(comp.id, tree);
  return tree;
}

/** Composant de librairie importé par clé, une fois par analyse (un import est une requête réseau). */
export async function importComponentCached(ctx: ScanContext, key: string): Promise<ComponentNode | null> {
  if (ctx.importedComponents.has(key)) return ctx.importedComponents.get(key) ?? null;
  let comp: ComponentNode | null = null;
  try {
    comp = await figma.importComponentByKeyAsync(key);
  } catch {
    comp = null;
  }
  ctx.importedComponents.set(key, comp);
  return comp;
}

export function variantLabel(comp: ComponentNode): string {
  const set = comp.parent?.type === 'COMPONENT_SET' ? comp.parent : null;
  return set ? `${set.name} / ${comp.name}` : comp.name;
}

export function reattachPlan(frame: FrameNode, comp: ComponentNode, result: MatchResult, forced = false): FixPlan {
  return {
    kind: 'reattach-instance',
    nodeId: frame.id,
    name: frame.name,
    componentId: comp.remote ? undefined : comp.id,
    componentKey: comp.remote ? comp.key : undefined,
    overrides: result.overrides,
    extras: forced && result.extras.length ? result.extras : undefined,
    forced: forced || undefined,
  };
}

export const reasonDetail = (reasons: string[]) =>
  reasons
    .map((r) => r.slice(r.indexOf(':') + 1))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
    .join(', ');

/** Profondeur d'un calque sous sa page (0 = au niveau de la page). */
export function nodeDepth(node: BaseNode): number {
  let d = 0;
  let p = node.parent;
  while (p && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
    d++;
    p = p.parent;
  }
  return d;
}

/**
 * Ordre d'application d'un lot : d'abord les corrections de valeurs (couleurs, styles, tailles),
 * puis les rattachements du plus profond au moins profond. Ainsi un calque n'est jamais remplacé
 * avant que ses propres corrections soient faites, et un parent rattaché retrouve ses enfants
 * déjà rattachés (la correspondance est recalculée à l'application).
 */
export function sortForApply<T>(items: T[], info: (item: T) => { reattach: boolean; depth: number }): T[] {
  return items
    .map((item, index) => ({ item, index, ...info(item) }))
    .sort((a, b) => Number(a.reattach) - Number(b.reattach) || (a.reattach ? b.depth - a.depth : 0) || a.index - b.index)
    .map((x) => x.item);
}
