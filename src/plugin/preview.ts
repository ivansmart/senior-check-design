/// <reference types="@figma/plugin-typings" />
/**
 * Aperçu avant / après : on clone le cadre racine hors écran, on applique les
 * plans de correction sur le clone, on exporte les deux en PNG, puis on
 * supprime le clone. Le document revient exactement à son état initial.
 */
import type { PreviewFrame } from '../shared/types';
import { applyPlan } from './fix/apply';
import type { FixPlan } from './fix/plans';

export interface PreviewItem {
  issueId: string;
  nodeId: string;
  plan: FixPlan;
}

export interface PreviewOutput {
  frames: PreviewFrame[];
  /** Corrections non rendues (cadre au-delà de `maxRoots`, calque disparu). */
  skipped: number;
}

/** Côté maximal (px image) d'un export, pour borner mémoire et temps de rendu. */
const MAX_EDGE = 1400;
const PREVIEW_TAG = 'scd:preview-clone';
/** Décalage du clone, loin de tout contenu plausible. */
const FAR = 200000;

type Parent = BaseNode & ChildrenMixin;

/** Cadre racine d'aperçu : l'ancêtre direct sous la page (ou sous une section). */
function previewRootOf(node: SceneNode): SceneNode {
  let n: SceneNode = node;
  while (n.parent && n.parent.type !== 'PAGE' && n.parent.type !== 'DOCUMENT' && n.parent.type !== 'SECTION') n = n.parent as SceneNode;
  return n;
}

/** Chemin d'indices de `root` vers `node`, pour retrouver le calque homologue dans le clone. */
function indexPath(root: SceneNode, node: SceneNode): number[] | null {
  const path: number[] = [];
  let n: SceneNode = node;
  while (n !== root) {
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

interface Group {
  root: SceneNode;
  items: { item: PreviewItem; path: number[] }[];
}

export async function renderPreview(items: PreviewItem[], maxRoots: number): Promise<PreviewOutput> {
  const groups = new Map<string, Group>();
  let located = 0;
  for (const item of items) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE' || (node as SceneNode).removed) continue;
    const root = previewRootOf(node as SceneNode);
    const path = indexPath(root, node as SceneNode);
    if (!path) continue;
    const group = groups.get(root.id) ?? { root, items: [] };
    group.items.push({ item, path });
    groups.set(root.id, group);
    located++;
  }
  const ordered = [...groups.values()].sort((a, b) => b.items.length - a.items.length).slice(0, maxRoots);
  const frames: PreviewFrame[] = [];
  let rendered = 0;
  for (const group of ordered) {
    const { root } = group;
    if (!('width' in root) || root.width <= 0 || root.height <= 0) continue;
    const scale = Math.min(2, MAX_EDGE / Math.max(root.width, root.height));
    const before = await exportPng(root, scale);
    let clone: SceneNode | null = null;
    let applied = 0;
    let failed = 0;
    try {
      clone = root.clone();
      clone.setPluginData(PREVIEW_TAG, '1');
      clone.name = root.name;
      clone.x = root.x + FAR;
      clone.y = root.y + FAR;
      clone.locked = true;
      for (const { item, path } of group.items) {
        const target = follow(clone, path);
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
      const after = await exportPng(clone, scale);
      frames.push({
        rootId: root.id,
        name: root.name,
        width: root.width,
        height: root.height,
        scale,
        before,
        after,
        applied,
        failed,
        issueIds: group.items.map((g) => g.item.issueId),
      });
      rendered += group.items.length;
    } finally {
      if (clone && !clone.removed) clone.remove();
    }
  }
  return { frames, skipped: located - rendered };
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
