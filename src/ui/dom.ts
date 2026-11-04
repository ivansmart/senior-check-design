/** Helpers DOM minimalistes (pas de framework : chargement instantané dans l'iframe). */

type Child = Node | string | number | null | undefined | false | Child[];

export type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      node.className = String(v);
    } else if (k === 'style') {
      node.setAttribute('style', String(v));
    } else if (v === true) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }
  append(node, children);
  return node;
}

export function append(parent: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(parent, c);
    else if (c instanceof Node) parent.appendChild(c);
    else parent.appendChild(document.createTextNode(String(c)));
  }
}

export function svgIcon(name: IconName, size = 14): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
}

export type IconName =
  | 'back'
  | 'check'
  | 'close'
  | 'search'
  | 'settings'
  | 'target'
  | 'refresh'
  | 'export'
  | 'eye'
  | 'eye-off'
  | 'wand'
  | 'alert'
  | 'info'
  | 'external'
  | 'play'
  | 'undo'
  | 'sparkle'
  | 'frame'
  | 'shape'
  | 'text'
  | 'component'
  | 'instance'
  | 'group'
  | 'section'
  | 'variable'
  | 'style'
  | 'sliders'
  | 'contrast'
  | 'chevron'
  | 'layers'
  | 'arrow-right'
  | 'chevron-right'
  | 'star'
  | 'compare'
  | 'collapse'
  | 'expand'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit';

const ICONS: Record<IconName, string> = {
  back: '<path d="M10 3 5 8l5 5"/>',
  check: '<path d="m3 8.5 3 3 7-7"/>',
  close: '<path d="m4 4 8 8M12 4l-8 8"/>',
  search: '<circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.3 3.3"/>',
  settings: '<circle cx="8" cy="8" r="2"/><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65 12.4 3.6"/>',
  target: '<circle cx="8" cy="8" r="5.25"/><circle cx="8" cy="8" r="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"/>',
  refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5V6H9.5"/>',
  export: '<path d="M8 10V2.5M5 5.5l3-3 3 3"/><path d="M2.5 9.5v3a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3"/>',
  eye: '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/>',
  'eye-off': '<path d="M2 2l12 12M6.3 6.4A2 2 0 0 0 9.6 9.7M3.9 4.6C2.3 5.9 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.1 0 2.1-.3 3-.8M6.6 3.7c.5-.1.9-.2 1.4-.2 4 0 6.5 4.5 6.5 4.5s-.6 1.1-1.7 2.3"/>',
  wand: '<path d="m3 13 7.5-7.5M10.5 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6ZM4 3l.4 1 1 .4-1 .4L4 5.8l-.4-1-1-.4 1-.4Z"/>',
  alert: '<path d="M8 2.5 14 13H2L8 2.5Z"/><path d="M8 6.5v3M8 11.2v.3"/>',
  info: '<circle cx="8" cy="8" r="5.75"/><path d="M8 7.25V11M8 5v.3"/>',
  external: '<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5"/><path d="M11 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3"/>',
  play: '<path d="M4.5 3.2v9.6L12.5 8 4.5 3.2Z"/>',
  undo: '<path d="M3.5 6.5H9a3.5 3.5 0 0 1 0 7H6"/><path d="M6 3.5 3 6.5l3 3"/>',
  sparkle: '<path d="M8 2.5l1.3 3.2 3.2 1.3-3.2 1.3L8 11.5 6.7 8.3 3.5 7l3.2-1.3Z"/>',
  frame: '<path d="M4.5 1.5v13M11.5 1.5v13M1.5 4.5h13M1.5 11.5h13"/>',
  shape: '<rect x="2.5" y="2.5" width="7" height="7" rx="1"/><circle cx="10.5" cy="10.5" r="3"/>',
  text: '<path d="M3 3.5h10M8 3.5v9M5.5 12.5h5"/>',
  component: '<path d="M8 1.8 11.2 5 8 8.2 4.8 5 8 1.8ZM8 7.8l3.2 3.2L8 14.2 4.8 11 8 7.8Z"/>',
  instance: '<path d="M8 2.2 13.8 8 8 13.8 2.2 8 8 2.2Z"/>',
  group: '<path d="M2.5 2.5h3M2.5 2.5v3M13.5 2.5h-3M13.5 2.5v3M2.5 13.5h3M2.5 13.5v-3M13.5 13.5h-3M13.5 13.5v-3"/><rect x="5.5" y="5.5" width="5" height="5" rx="0.5"/>',
  section: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12"/>',
  variable: '<path d="M8 1.5c.4 2.6 2.4 4.6 5 5-2.6.4-4.6 2.4-5 5-.4-2.6-2.4-4.6-5-5 2.6-.4 4.6-2.4 5-5Z" fill="currentColor" stroke="none"/>',
  style: '<circle cx="5" cy="5" r="2" fill="currentColor" stroke="none"/><circle cx="11" cy="5" r="2" fill="currentColor" stroke="none"/><circle cx="5" cy="11" r="2" fill="currentColor" stroke="none"/><circle cx="11" cy="11" r="2" fill="currentColor" stroke="none"/>',
  sliders: '<path d="M5 2v4.25M5 9.75V14M11 2v6.25M11 11.75V14"/><circle cx="5" cy="8" r="1.75"/><circle cx="11" cy="10" r="1.75"/>',
  contrast: '<circle cx="8" cy="8" r="6"/><path d="M8 2a3 3 0 0 1 0 6 3 3 0 0 0 0 6"/><path d="M3.2 6h3.3M2.4 8.5h3.6M3.2 11h2.4"/>',
  chevron: '<path d="m4 6.5 4 4 4-4"/>',
  'arrow-right': '<path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/>',
  'chevron-right': '<path d="m5 3.5 4 4.5-4 4.5"/>',
  star: '<path d="M8 1.5c.6 3.4 3.1 5.9 6.5 6.5-3.4.6-5.9 3.1-6.5 6.5-.6-3.4-3.1-5.9-6.5-6.5 3.4-.6 5.9-3.1 6.5-6.5Z"/>',
  layers: '<path d="M8 2.5 14 6 8 9.5 2 6l6-3.5Z"/><path d="m2.5 9 5.5 3.3L13.5 9"/>',
  compare: '<rect x="1.5" y="3.5" width="5.5" height="9" rx="1"/><rect x="9" y="3.5" width="5.5" height="9" rx="1"/><path d="M8 1.5v13" stroke-dasharray="1.5 1.5"/>',
  collapse: '<path d="m4 10 4-4 4 4"/>',
  expand: '<path d="m4 6 4 4 4-4"/>',
  'zoom-in': '<circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.3 3.3M7 5v4M5 7h4"/>',
  'zoom-out': '<circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.3 3.3M5 7h4"/>',
  fit: '<path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10"/><rect x="5.5" y="5.5" width="5" height="5" rx="0.5"/>',
};

export function clear(node: Node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Anime un compteur numérique (ease-out) ; retourne une fonction d'annulation. */
export function animateNumber(from: number, to: number, duration: number, onFrame: (v: number) => void): () => void {
  if (duration <= 0 || from === to) {
    onFrame(to);
    return () => {};
  }
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    onFrame(Math.round(from + (to - from) * eased));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 500);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = el('textarea', { style: 'position:fixed;opacity:0;left:-9999px' }, text);
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
