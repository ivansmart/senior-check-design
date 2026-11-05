/**
 * Icônes de l'en-tête : le cœur du Design Health, dont la couleur et l'état suivent le score
 * (brillant, entier, fissuré, brisé, en morceaux), et l'icône fixe du Craft Readiness.
 */
export type HeartState = 'top' | 'high' | 'mid' | 'low' | 'critical';

/** Brillant à partir de 90, entier jusqu'à 80, fissuré jusqu'à 60, brisé jusqu'à 40, en morceaux en dessous. */
export function heartState(score: number): HeartState {
  return score >= 90 ? 'top' : score >= 80 ? 'high' : score >= 60 ? 'mid' : score >= 40 ? 'low' : 'critical';
}

const NS = 'http://www.w3.org/2000/svg';

/** Cœur entier (24 × 24). */
const FULL = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
/** Les deux moitiés, séparées par une cassure en zigzag qui descend du creux au bout. */
const LEFT = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09L10.6 8.6 13 11l-2.2 3.6 1.6 3L12 21.35z';
const RIGHT = 'M12 5.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35l.4-3.75-1.6-3L13 11l-2.4-2.4z';
/** Fissure, dessinée dans la couleur du fond pour ouvrir le cœur sans le casser. */
const CRACK = 'M12 5.09L10.6 8.6 13 11l-2.2 3.6 1.6 3L12 21.35';
/** Étincelles autour du cœur quand le score est au sommet. */
const SPARKLES =
  '<g class="sparkles"><path d="M19.4 .8l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z"/><path d="M3.1 1.4l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z"/><path d="M21.9 13l.45 1.05 1.05.45-1.05.45-.45 1.05-.45-1.05-1.05-.45 1.05-.45z"/></g>';

function heartMarkup(state: HeartState): string {
  switch (state) {
    case 'top':
      return `<path d="${FULL}"/>${SPARKLES}`;
    case 'high':
      return `<path d="${FULL}"/>`;
    case 'mid':
      return `<path d="${FULL}"/><path class="crack" d="${CRACK}"/>`;
    case 'low':
      return `<path d="${LEFT}" transform="translate(-0.9 0.5) rotate(-7 8 12)"/><path d="${RIGHT}" transform="translate(0.9 0.5) rotate(7 16 12)"/>`;
    case 'critical':
      return `<path d="${LEFT}" transform="translate(-1.9 1.3) rotate(-14 8 12)"/><path class="shard" d="${RIGHT}" transform="translate(1.9 1.3) rotate(14 16 12)"/>`;
  }
}

function svg(viewBox: string, size: number, className: string, markup: string): SVGSVGElement {
  const node = document.createElementNS(NS, 'svg');
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('width', String(size));
  node.setAttribute('height', String(size));
  node.setAttribute('class', className);
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  node.innerHTML = markup;
  return node;
}

/** Cœur du Design Health dans l'état donné ; la couleur vient de la feuille de style (`data-heart` sur la puce). */
export function heartIcon(state: HeartState, size = 14): SVGSVGElement {
  return svg('-1 -1 26 26', size, `heart heart-${state}`, heartMarkup(state));
}

/** Icône du Craft Readiness : un outil, sans variation d'état. */
export function craftIcon(size = 13): SVGSVGElement {
  return svg(
    '0 0 24 24',
    size,
    'craft-icon',
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  );
}
