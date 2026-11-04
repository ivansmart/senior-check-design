/// <reference types="@figma/plugin-typings" />
import type { RGB01 } from '../../shared/color';
import { composite } from '../../shared/color';
import type { Background, ScanContext } from './context';

/** Ancêtres d'un node, du parent direct jusqu'à la page (exclue). */
export function ancestors(node: SceneNode, ctx: ScanContext): SceneNode[] {
  const cached = ctx.ancestorsCache.get(node.id);
  if (cached) return cached;
  const out: SceneNode[] = [];
  let p = node.parent;
  while (p && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
    out.push(p as SceneNode);
    p = p.parent;
  }
  ctx.ancestorsCache.set(node.id, out);
  return out;
}

export function pageOf(node: SceneNode): PageNode | null {
  let p: BaseNode | null = node;
  while (p && p.type !== 'PAGE') p = p.parent;
  return (p as PageNode) ?? null;
}

/** Chemin lisible : page › ancêtres (du plus haut au plus proche). */
export function pathOf(node: SceneNode, ctx: ScanContext): string[] {
  const anc = ancestors(node, ctx);
  const page = pageOf(node);
  const names = anc.map((a) => a.name).reverse();
  return page ? [page.name, ...names] : names;
}

export function isInsideInstance(node: SceneNode, ctx: ScanContext): boolean {
  return ancestors(node, ctx).some((a) => a.type === 'INSTANCE');
}

export function isEffectivelyHidden(node: SceneNode, ctx: ScanContext): boolean {
  if (!node.visible) return true;
  return ancestors(node, ctx).some((a) => !a.visible);
}

export function isEffectivelyLocked(node: SceneNode, ctx: ScanContext): boolean {
  if (node.locked) return true;
  return ancestors(node, ctx).some((a) => a.locked);
}

export function isInsideComponentDefinition(node: SceneNode, ctx: ScanContext): boolean {
  return ancestors(node, ctx).some((a) => a.type === 'COMPONENT' || a.type === 'COMPONENT_SET');
}

/** Couleur effective d'un paint solide (résout la variable liée pour ce node). */
export async function resolveSolidPaint(
  paint: SolidPaint,
  consumer: SceneNode,
): Promise<{ rgb: RGB01; alpha: number; bound: boolean }> {
  const alias = paint.boundVariables?.color;
  if (alias) {
    const variable = await figma.variables.getVariableByIdAsync(alias.id);
    if (variable) {
      try {
        const { value } = variable.resolveForConsumer(consumer);
        if (value && typeof value === 'object' && 'r' in value) {
          const v = value as RGBA;
          const a = 'a' in v && typeof v.a === 'number' ? v.a : 1;
          return { rgb: { r: v.r, g: v.g, b: v.b }, alpha: (paint.opacity ?? 1) * a, bound: true };
        }
      } catch {
        /* variable illisible : on retombe sur la couleur brute */
      }
    }
    return { rgb: { r: paint.color.r, g: paint.color.g, b: paint.color.b }, alpha: paint.opacity ?? 1, bound: true };
  }
  return { rgb: { r: paint.color.r, g: paint.color.g, b: paint.color.b }, alpha: paint.opacity ?? 1, bound: false };
}

function hasFills(node: BaseNode): node is SceneNode & MinimalFillsMixin {
  return 'fills' in node;
}

/**
 * Fond effectif derrière un node : remonte les ancêtres jusqu'à trouver un fill
 * solide opaque. Compose les fills semi-transparents. Signale image/dégradé/opacité.
 */
export async function backgroundBehind(node: SceneNode, ctx: ScanContext): Promise<Background> {
  const cached = ctx.backgroundCache.get(node.id);
  if (cached) return cached;
  const result = await computeBackground(node, ctx, 0);
  ctx.backgroundCache.set(node.id, result);
  return result;
}

async function computeBackground(node: SceneNode, ctx: ScanContext, depth: number): Promise<Background> {
  const chain = ancestors(node, ctx);
  // Couches semi-transparentes à composer, du plus proche au plus lointain.
  const layers: { rgb: RGB01; alpha: number }[] = [];
  for (const anc of chain) {
    if ('opacity' in anc && typeof anc.opacity === 'number' && anc.opacity < 0.99) return { kind: 'complex', reason: 'opacity' };
    if (!hasFills(anc)) continue;
    const fills = anc.fills;
    if (fills === figma.mixed) return { kind: 'complex', reason: 'mixed' };
    const visible = (fills as readonly Paint[]).filter((p) => p.visible !== false && (p.opacity ?? 1) > 0);
    if (!visible.length) continue;
    // On lit du dessus vers le dessous (dernier paint = dessus).
    for (let i = visible.length - 1; i >= 0; i--) {
      const p = visible[i];
      if (p.type === 'IMAGE' || p.type === 'VIDEO') return { kind: 'complex', reason: 'image' };
      if (p.type !== 'SOLID') return { kind: 'complex', reason: 'gradient' };
      const { rgb, alpha } = await resolveSolidPaint(p, anc);
      if (alpha >= 0.99) return { kind: 'solid', rgb: flatten(layers, rgb) };
      layers.push({ rgb, alpha });
    }
  }
  // Fond de page.
  const page = pageOf(node);
  if (page) {
    const bg = page.backgrounds.find((p) => p.visible !== false && p.type === 'SOLID') as SolidPaint | undefined;
    if (bg) return { kind: 'solid', rgb: flatten(layers, { r: bg.color.r, g: bg.color.g, b: bg.color.b }) };
  }
  if (layers.length && depth === 0) {
    // Aucun fond opaque trouvé : on compose sur blanc en dernier recours (page par défaut).
    return { kind: 'solid', rgb: flatten(layers, { r: 1, g: 1, b: 1 }) };
  }
  return { kind: 'unknown' };
}

/** Compose les couches (du plus proche au plus lointain) sur une base opaque. */
function flatten(layers: { rgb: RGB01; alpha: number }[], base: RGB01): RGB01 {
  let acc = base;
  for (let i = layers.length - 1; i >= 0; i--) acc = composite(layers[i].rgb, layers[i].alpha, acc);
  return acc;
}

/** Texte lisible d'un FontName. */
export function fontLabel(font: FontName, size: number, lineHeight?: LineHeight): string {
  const lh =
    lineHeight && lineHeight.unit !== 'AUTO'
      ? lineHeight.unit === 'PERCENT'
        ? `/${Math.round(lineHeight.value)}%`
        : `/${Math.round(lineHeight.value * 10) / 10}`
      : '';
  return `${font.family} ${font.style} ${Math.round(size * 10) / 10}${lh}`;
}

export function hasAutoLayout(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode {
  return 'layoutMode' in node && (node as FrameNode).layoutMode !== 'NONE';
}

export function isInteractiveByReactions(node: SceneNode): boolean {
  if (!('reactions' in node)) return false;
  return (node as SceneNode & ReactionMixin).reactions.some((r) => {
    const t = r.trigger?.type;
    return t === 'ON_CLICK' || t === 'ON_PRESS' || t === 'ON_HOVER' || t === 'MOUSE_DOWN' || t === 'MOUSE_UP';
  });
}

/** Couleur sous forme de nombre (0–255) pour les messages. */
export const round1 = (v: number) => Math.round(v * 10) / 10;
