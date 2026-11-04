/**
 * Clé visuelle d'une liste de peintures (remplissages ou contours) : ce qui change le rendu,
 * et rien d'autre. Deux peintures de même couleur, l'une liée à une variable et l'autre
 * codée en dur, ont la même clé : on ne remplace pas un token par sa valeur brute.
 * Pur : travaille sur des peintures sérialisées (JSON), sans l'API Figma.
 */

interface RgbLike {
  r: number;
  g: number;
  b: number;
  a?: number;
}

const hex = (c: RgbLike) =>
  '#' +
  [c.r, c.g, c.b]
    .map((v) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 255)
      .toString(16)
      .padStart(2, '0'))
    .join('');

const pct = (v: unknown) => Math.round((typeof v === 'number' ? v : 1) * 100);

export function visualPaintKey(paints: unknown[] | undefined): string {
  if (!paints) return '';
  const parts: string[] = [];
  for (const raw of paints) {
    const p = raw as { type?: string; visible?: boolean; opacity?: number; color?: RgbLike; gradientStops?: { color?: RgbLike; position?: number }[]; imageHash?: string; scaleMode?: string };
    if (p.visible === false) continue; // une peinture masquée ne change pas le rendu
    const op = pct(p.opacity);
    if (p.type === 'SOLID' && p.color) parts.push(`S|${hex(p.color)}|${op}`);
    else if (typeof p.type === 'string' && p.type.startsWith('GRADIENT')) {
      const stops = (p.gradientStops ?? []).map((s) => `${s.color ? hex(s.color) : ''}@${pct(s.color?.a)}:${pct(s.position ?? 0)}`).join(',');
      parts.push(`${p.type}|${op}|${stops}`);
    } else if (p.type === 'IMAGE') parts.push(`I|${p.imageHash ?? ''}|${p.scaleMode ?? ''}|${op}`);
    else parts.push(`${p.type ?? '?'}|${op}`);
  }
  return parts.join(';');
}
