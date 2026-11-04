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
  | 'sparkle';

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
