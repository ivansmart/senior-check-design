/**
 * Export des variables locales (Pro) : modèle sérialisable construit côté
 * sandbox, formats générés ici (testables sans Figma).
 */

export type TokenType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export type TokenValue =
  | { kind: 'color'; hex: string }
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'alias'; collection: string; name: string };

export interface TokenVariable {
  name: string;
  type: TokenType;
  description?: string;
  scopes: string[];
  valuesByMode: Record<string, TokenValue>;
}

export interface TokenCollection {
  name: string;
  modes: { id: string; name: string }[];
  defaultModeId: string;
  variables: TokenVariable[];
}

export interface TokenModel {
  collections: TokenCollection[];
}

const segments = (name: string) => name.split('/').map((s) => s.trim()).filter(Boolean);
const kebab = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

function findVariable(model: TokenModel, collection: string, name: string): { col: TokenCollection; v: TokenVariable } | null {
  const col = model.collections.find((c) => c.name === collection);
  const v = col?.variables.find((x) => x.name === name);
  return col && v ? { col, v } : null;
}

/** Valeur finale (alias résolus) d'une variable pour un mode, en suivant les modes de même nom. */
export function resolveValue(model: TokenModel, col: TokenCollection, v: TokenVariable, modeId: string, depth = 0): TokenValue | null {
  const value = v.valuesByMode[modeId] ?? v.valuesByMode[col.defaultModeId];
  if (!value) return null;
  if (value.kind !== 'alias') return value;
  if (depth > 12) return null;
  const target = findVariable(model, value.collection, value.name);
  if (!target) return null;
  const modeName = col.modes.find((m) => m.id === modeId)?.name;
  const targetMode = target.col.modes.find((m) => m.name === modeName)?.id ?? target.col.defaultModeId;
  return resolveValue(model, target.col, target.v, targetMode, depth + 1);
}

function plain(value: TokenValue): string | number | boolean {
  switch (value.kind) {
    case 'color':
      return value.hex;
    case 'number':
      return value.value;
    case 'string':
      return value.value;
    case 'boolean':
      return value.value;
    case 'alias':
      return `{${[kebab(value.collection), ...segments(value.name).map(kebab)].join('.')}}`;
  }
}

const dtcgType = (t: TokenType) => (t === 'COLOR' ? 'color' : t === 'FLOAT' ? 'number' : t === 'STRING' ? 'string' : 'boolean');

/** Design Tokens Community Group (format JSON « $type / $value »), un groupe par collection, modes en extension. */
export function toDtcg(model: TokenModel): string {
  const root: Record<string, unknown> = {};
  for (const col of model.collections) {
    const group: Record<string, unknown> = {};
    for (const v of col.variables) {
      let node = group;
      const path = segments(v.name).map(kebab);
      for (const seg of path.slice(0, -1)) {
        node[seg] = (node[seg] as Record<string, unknown>) ?? {};
        node = node[seg] as Record<string, unknown>;
      }
      const def = v.valuesByMode[col.defaultModeId];
      const token: Record<string, unknown> = { $type: dtcgType(v.type), $value: def ? plain(def) : null };
      if (v.description) token.$description = v.description;
      const modes: Record<string, unknown> = {};
      for (const m of col.modes) {
        const mv = v.valuesByMode[m.id];
        if (mv) modes[m.name] = plain(mv);
      }
      token.$extensions = { 'com.figma': { scopes: v.scopes, ...(col.modes.length > 1 ? { modes } : {}) } };
      node[path[path.length - 1] ?? kebab(v.name)] = token;
    }
    root[kebab(col.name)] = group;
  }
  return JSON.stringify(root, null, 2) + '\n';
}

const cssVar = (collection: string, name: string) => `--${kebab(collection)}-${segments(name).map(kebab).join('-')}`;

function cssValue(value: TokenValue, type: TokenType): string {
  switch (value.kind) {
    case 'alias':
      return `var(${cssVar(value.collection, value.name)})`;
    case 'number':
      return type === 'FLOAT' ? `${value.value}px` : String(value.value);
    case 'color':
      return value.hex;
    case 'string':
      return JSON.stringify(value.value);
    case 'boolean':
      return value.value ? '1' : '0';
  }
}

/** Custom properties CSS : `:root` pour le mode par défaut, `[data-theme="mode"]` pour les autres modes. */
export function toCss(model: TokenModel): string {
  const lines: string[] = [];
  lines.push(':root {');
  for (const col of model.collections) {
    for (const v of col.variables) {
      const value = v.valuesByMode[col.defaultModeId];
      if (value) lines.push(`  ${cssVar(col.name, v.name)}: ${cssValue(value, v.type)};`);
    }
  }
  lines.push('}');
  for (const col of model.collections) {
    for (const mode of col.modes) {
      if (mode.id === col.defaultModeId) continue;
      lines.push('');
      lines.push(`[data-theme="${kebab(mode.name)}"] {`);
      for (const v of col.variables) {
        const value = v.valuesByMode[mode.id];
        if (value) lines.push(`  ${cssVar(col.name, v.name)}: ${cssValue(value, v.type)};`);
      }
      lines.push('}');
    }
  }
  return lines.join('\n') + '\n';
}

type Nested = { [key: string]: Nested | string | number };

function setPath(root: Nested, path: string[], value: string | number) {
  let node = root;
  for (const seg of path.slice(0, -1)) {
    const next = node[seg];
    if (typeof next !== 'object' || next === null) node[seg] = {};
    node = node[seg] as Nested;
  }
  const last = path[path.length - 1];
  if (typeof node[last] === 'object') (node[last] as Nested).DEFAULT = value;
  else node[last] = value;
}

const tailwindBucket = (v: TokenVariable): 'spacing' | 'borderRadius' | 'fontSize' | 'other' => {
  const s = new Set(v.scopes);
  if (s.has('CORNER_RADIUS') || /radius|corner|round/i.test(v.name)) return 'borderRadius';
  if (s.has('FONT_SIZE') || /font.?size|text.?size|type.?scale/i.test(v.name)) return 'fontSize';
  if (s.has('GAP') || s.has('WIDTH_HEIGHT') || /spac|gap|pad|inset|size|grid/i.test(v.name)) return 'spacing';
  return 'other';
};

/** `theme.extend` Tailwind : couleurs imbriquées par chemin, nombres répartis en spacing / borderRadius / fontSize (valeurs résolues, mode par défaut). */
export function toTailwind(model: TokenModel): string {
  const colors: Nested = {};
  const spacing: Nested = {};
  const borderRadius: Nested = {};
  const fontSize: Nested = {};
  const other: Nested = {};
  for (const col of model.collections) {
    for (const v of col.variables) {
      const resolved = resolveValue(model, col, v, col.defaultModeId);
      if (!resolved || resolved.kind === 'alias') continue;
      const path = segments(v.name).map(kebab);
      if (v.type === 'COLOR' && resolved.kind === 'color') {
        setPath(colors, path[0] === 'color' || path[0] === 'colors' ? path.slice(1) : path, resolved.hex);
      } else if (v.type === 'FLOAT' && resolved.kind === 'number') {
        const bucket = tailwindBucket(v);
        const target = bucket === 'spacing' ? spacing : bucket === 'borderRadius' ? borderRadius : bucket === 'fontSize' ? fontSize : other;
        setPath(target, [path.slice(1).join('-') || path[0]], `${resolved.value}px`);
      }
    }
  }
  const extend: Record<string, Nested> = {};
  if (Object.keys(colors).length) extend.colors = colors;
  if (Object.keys(spacing).length) extend.spacing = spacing;
  if (Object.keys(borderRadius).length) extend.borderRadius = borderRadius;
  if (Object.keys(fontSize).length) extend.fontSize = fontSize;
  if (Object.keys(other).length) extend.figmaNumbers = other;
  return `/** Généré par Senior Check Design à partir des variables Figma locales. */\nmodule.exports = {\n  theme: {\n    extend: ${JSON.stringify(extend, null, 2).replace(/\n/g, '\n    ')},\n  },\n};\n`;
}

export function countVariables(model: TokenModel): number {
  return model.collections.reduce((n, c) => n + c.variables.length, 0);
}
