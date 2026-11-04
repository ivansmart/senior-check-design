/// <reference types="@figma/plugin-typings" />
/**
 * Révèle des calques sans les cacher sous la fenêtre du plugin : après le
 * cadrage standard, on lit la position de la fenêtre (figma.ui.getPosition)
 * et, si elle recouvre les calques, on recentre la vue dans la plus grande
 * zone libre du viewport, en dézoomant si nécessaire.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hauteur de la barre de titre que Figma ajoute au-dessus de l'iframe du plugin. */
const UI_CHROME_H = 40;
/** Marge autour des calques révélés (px écran). */
const MARGIN = 24;
/** Zone minimale pour accueillir un calque (px écran). */
const MIN_REGION = 96;
/** Panneaux flottants (UI3) : on évite d'y placer le calque sur les grands écrans. */
const PANEL_INSET = 240;
const PANEL_INSET_MIN_WIDTH = 1100;

function union(rects: Rect[]): Rect {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.width);
    y2 = Math.max(y2, r.y + r.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clip(a: Box, to: Box): Box {
  const x = Math.max(a.x, to.x);
  const y = Math.max(a.y, to.y);
  return { x, y, w: Math.min(a.x + a.w, to.x + to.w) - x, h: Math.min(a.y + a.h, to.y + to.h) - y };
}

export function revealNodes(nodes: readonly SceneNode[], uiSize: { width: number; height: number }): void {
  figma.viewport.scrollAndZoomIntoView(nodes);
  try {
    const rects = nodes.map((n) => n.absoluteBoundingBox).filter((r): r is Rect => Boolean(r));
    if (!rects.length) return;
    const box = union(rects);
    const vb = figma.viewport.bounds;
    const zoom = figma.viewport.zoom;
    // Tout est calculé en pixels écran, invariants au zoom et au centre de la vue.
    const vw = vb.width * zoom;
    const vh = vb.height * zoom;
    const pos = figma.ui.getPosition().canvasSpace;
    const plugin = clip(
      { x: (pos.x - vb.x) * zoom, y: (pos.y - vb.y) * zoom - UI_CHROME_H, w: uiSize.width, h: uiSize.height + UI_CHROME_H },
      { x: 0, y: 0, w: vw, h: vh },
    );
    if (plugin.w <= 0 || plugin.h <= 0) return; // fenêtre hors du viewport
    const target: Box = { x: (box.x - vb.x) * zoom, y: (box.y - vb.y) * zoom, w: box.width * zoom, h: box.height * zoom };
    if (!intersects(target, plugin)) return; // déjà visible
    const inset = vw >= PANEL_INSET_MIN_WIDTH ? PANEL_INSET : 0;
    const regions: Box[] = [
      { x: inset, y: 0, w: plugin.x - inset, h: vh },
      { x: plugin.x + plugin.w, y: 0, w: vw - inset - (plugin.x + plugin.w), h: vh },
      { x: inset, y: 0, w: vw - 2 * inset, h: plugin.y },
      { x: inset, y: plugin.y + plugin.h, w: vw - 2 * inset, h: vh - (plugin.y + plugin.h) },
    ].filter((r) => r.w >= MIN_REGION && r.h >= MIN_REGION);
    if (!regions.length) return;
    const fits = regions.filter((r) => r.w - 2 * MARGIN >= target.w && r.h - 2 * MARGIN >= target.h);
    const pick = (fits.length ? fits : regions).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    let nextZoom = zoom;
    if (!fits.length) nextZoom = Math.max(0.02, Math.min(zoom, (pick.w - 2 * MARGIN) / box.width, (pick.h - 2 * MARGIN) / box.height));
    const regionCx = pick.x + pick.w / 2;
    const regionCy = pick.y + pick.h / 2;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    figma.viewport.zoom = nextZoom;
    figma.viewport.center = { x: cx + (vw / 2 - regionCx) / nextZoom, y: cy + (vh / 2 - regionCy) / nextZoom };
  } catch {
    /* position de la fenêtre indisponible : cadrage standard conservé */
  }
}
