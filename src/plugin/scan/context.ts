/// <reference types="@figma/plugin-typings" />
import type { RGB01 } from '../../shared/color';
import { colorKey, rgbToHex } from '../../shared/color';
import type { ScaleCandidate } from '../../shared/scale';
import type { Category, ScanOptions, ScanProgress } from '../../shared/types';
import type { FixPlan } from '../fix/plans';

export interface ColorToken {
  id: string;
  name: string;
  collection: string;
  source: string; // 'Local' ou nom de la librairie
  remote: boolean;
  rgb: RGB01;
  alpha: number;
  scopes: VariableScope[];
  modeName?: string;
  isDefaultMode: boolean;
}

export interface FloatToken {
  id: string;
  name: string;
  collection: string;
  source: string;
  remote: boolean;
  value: number;
  scopes: VariableScope[];
}

export interface TextStyleInfo {
  id: string;
  name: string;
  remote: boolean;
  fontName: FontName;
  fontSize: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
}

export interface PaintStyleInfo {
  id: string;
  name: string;
  remote: boolean;
  rgb: RGB01;
  alpha: number;
}

export type Background =
  | { kind: 'solid'; rgb: RGB01 }
  | { kind: 'complex'; reason: 'image' | 'gradient' | 'opacity' | 'mixed' }
  | { kind: 'unknown' };

/** Issue brute produite par une règle ; le moteur complète chemin, statut et identifiant. */
export interface RawIssue {
  ruleId: string;
  node: SceneNode;
  /** Distingue plusieurs issues d'une même règle sur un même node. */
  slot?: string;
  severity?: 'error' | 'warning' | 'info';
  currentValue: string;
  swatch?: string;
  suggestion?: import('../../shared/types').Suggestion;
  fixSafety: 'safe' | 'review' | 'none';
  params?: Record<string, string | number>;
  plan?: FixPlan;
  /** Plans alternatifs, par id de suggestion alternative. */
  alternativePlans?: Record<string, FixPlan>;
}

export interface ComponentSetInfo {
  node: ComponentSetNode;
  name: string;
  kind: import('../../shared/names').ComponentKind;
  stateProp: string | null;
  /** Valeurs brutes de la propriété d'état. */
  stateValues: string[];
  /** Durées (ms) des transitions hover détectées sur les variantes. */
  hoverDurations: { nodeId: string; duration: number; easing: string }[];
}

export interface ScanContext {
  options: ScanOptions;
  activeRules: Set<string>;
  colors: ColorToken[];
  /** Clé exacte (#RRGGBB@alpha%) → tokens. */
  colorByKey: Map<string, ColorToken[]>;
  floats: FloatToken[];
  spacingScale: ScaleCandidate<FloatToken>[];
  radiusScale: ScaleCandidate<FloatToken>[];
  fontSizeScale: number[];
  textStyles: TextStyleInfo[];
  paintStyles: PaintStyleInfo[];
  paintStyleByKey: Map<string, PaintStyleInfo[]>;
  libraries: string[];
  warnings: string[];
  /** Nodes à ignorer (hors scope, masqués…) : rempli par le walker. */
  pageOf: Map<string, PageNode>;
  // caches
  ancestorsCache: Map<string, SceneNode[]>;
  backgroundCache: Map<string, Background>;
  // collecte pour les règles aggregate
  componentSets: ComponentSetInfo[];
  localComponents: { node: ComponentNode | ComponentSetNode; name: string }[];
  /** Au moins un component set a des réactions prototype (sinon on n'exige pas de transitions). */
  anySetHasReactions: boolean;
  found: Partial<Record<Category, number>>;
  reportProgress: (p: Partial<ScanProgress>) => void;
  isCancelled: () => boolean;
}

export const yieldToHost = (): Promise<void> =>
  typeof setTimeout === 'function' ? new Promise<void>((r) => setTimeout(r, 0)) : Promise.resolve();

type VariableAliasValue = { type: 'VARIABLE_ALIAS'; id: string };
const isAlias = (v: VariableValue): v is VariableAliasValue =>
  typeof v === 'object' && v !== null && (v as VariableAliasValue).type === 'VARIABLE_ALIAS';

/** Résout la valeur d'une variable pour un mode donné en suivant les alias. */
export async function resolveVariableValue(
  variable: Variable,
  modeId: string | undefined,
  depth = 0,
): Promise<VariableValue | undefined> {
  if (depth > 12) return undefined;
  const modes = Object.keys(variable.valuesByMode);
  if (!modes.length) return undefined;
  const mode = modeId && modeId in variable.valuesByMode ? modeId : modes[0];
  const value = variable.valuesByMode[mode];
  if (isAlias(value)) {
    const target = await figma.variables.getVariableByIdAsync(value.id);
    if (!target) return undefined;
    // On essaie de garder le même mode si la collection cible le connaît, sinon son mode par défaut.
    const targetCollection = await figma.variables.getVariableCollectionByIdAsync(target.variableCollectionId);
    const targetMode =
      modeId && target.valuesByMode[modeId] !== undefined ? modeId : targetCollection?.defaultModeId;
    return resolveVariableValue(target, targetMode, depth + 1);
  }
  return value;
}

const toRgb01 = (v: RGB | RGBA): { rgb: RGB01; alpha: number } => ({
  rgb: { r: v.r, g: v.g, b: v.b },
  alpha: 'a' in v ? v.a : 1,
});

function pushColor(ctx: ScanContext, token: ColorToken) {
  ctx.colors.push(token);
  const key = colorKey(token.rgb, token.alpha);
  const list = ctx.colorByKey.get(key) ?? [];
  list.push(token);
  ctx.colorByKey.set(key, list);
}

async function indexVariable(ctx: ScanContext, variable: Variable, source: string, collectionCache: Map<string, VariableCollection | null>) {
  let collection = collectionCache.get(variable.variableCollectionId);
  if (collection === undefined) {
    collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    collectionCache.set(variable.variableCollectionId, collection);
  }
  const collectionName = collection?.name ?? '';
  const modes = collection?.modes ?? Object.keys(variable.valuesByMode).map((modeId) => ({ modeId, name: '' }));
  const defaultModeId = collection?.defaultModeId ?? modes[0]?.modeId;

  if (variable.resolvedType === 'COLOR') {
    const seen = new Set<string>();
    for (const mode of modes) {
      const value = await resolveVariableValue(variable, mode.modeId);
      if (!value || typeof value !== 'object' || !('r' in value)) continue;
      const { rgb, alpha } = toRgb01(value as RGB | RGBA);
      const key = colorKey(rgb, alpha);
      if (seen.has(key)) continue;
      seen.add(key);
      pushColor(ctx, {
        id: variable.id,
        name: variable.name,
        collection: collectionName,
        source,
        remote: variable.remote,
        rgb,
        alpha,
        scopes: variable.scopes,
        modeName: modes.length > 1 ? mode.name : undefined,
        isDefaultMode: mode.modeId === defaultModeId,
      });
    }
  } else if (variable.resolvedType === 'FLOAT') {
    const value = await resolveVariableValue(variable, defaultModeId);
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    ctx.floats.push({
      id: variable.id,
      name: variable.name,
      collection: collectionName,
      source,
      remote: variable.remote,
      value,
      scopes: variable.scopes,
    });
  }
}

const hasScope = (scopes: VariableScope[], ...wanted: VariableScope[]) => scopes.some((s) => wanted.includes(s));

function buildFloatScales(ctx: ScanContext) {
  const spacingScoped = ctx.floats.filter((f) => hasScope(f.scopes, 'GAP', 'WIDTH_HEIGHT'));
  const radiusScoped = ctx.floats.filter((f) => hasScope(f.scopes, 'CORNER_RADIUS'));
  const fontScoped = ctx.floats.filter((f) => hasScope(f.scopes, 'FONT_SIZE'));
  const unscoped = ctx.floats.filter((f) => f.scopes.includes('ALL_SCOPES'));

  const spacingByName = unscoped.filter((f) => /spac|gap|pad|inset|\bsize\b|dimension|grid/i.test(f.name));
  const radiusByName = unscoped.filter((f) => /radius|corner|round/i.test(f.name));
  const fontByName = unscoped.filter((f) => /font.?size|text.?size|type.?scale|\bfs\b/i.test(f.name));

  const spacing = spacingScoped.length ? [...spacingScoped, ...spacingByName] : spacingByName;
  const radius = radiusScoped.length ? [...radiusScoped, ...radiusByName] : radiusByName;
  const font = fontScoped.length ? [...fontScoped, ...fontByName] : fontByName;

  const dedupe = (list: FloatToken[]) => {
    const seen = new Set<string>();
    return list.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
  };
  ctx.spacingScale = dedupe(spacing)
    .filter((f) => f.value >= 0 && f.value <= 512)
    .map((f) => ({ value: f.value, ref: f }));
  ctx.radiusScale = dedupe(radius)
    .filter((f) => f.value >= 0 && f.value <= 512)
    .map((f) => ({ value: f.value, ref: f }));
  const sizes = new Set<number>([...dedupe(font).map((f) => f.value), ...ctx.textStyles.map((s) => s.fontSize)]);
  ctx.fontSizeScale = [...sizes].filter((v) => v > 0).sort((a, b) => a - b);
}

export async function indexPaintStyle(ctx: ScanContext, style: PaintStyle) {
  const visible = style.paints.filter((p) => p.visible !== false);
  if (visible.length !== 1 || visible[0].type !== 'SOLID') return;
  const paint = visible[0];
  const info: PaintStyleInfo = {
    id: style.id,
    name: style.name,
    remote: style.remote,
    rgb: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
    alpha: paint.opacity ?? 1,
  };
  ctx.paintStyles.push(info);
  const key = colorKey(info.rgb, info.alpha);
  ctx.paintStyleByKey.set(key, [...(ctx.paintStyleByKey.get(key) ?? []), info]);
}

export function indexTextStyle(ctx: ScanContext, style: TextStyle) {
  if (ctx.textStyles.some((s) => s.id === style.id)) return;
  ctx.textStyles.push({
    id: style.id,
    name: style.name,
    remote: style.remote,
    fontName: style.fontName,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
  });
}

export function createContext(
  options: ScanOptions,
  activeRules: Set<string>,
  reportProgress: (p: Partial<ScanProgress>) => void,
  isCancelled: () => boolean,
): ScanContext {
  return {
    options,
    activeRules,
    colors: [],
    colorByKey: new Map(),
    floats: [],
    spacingScale: [],
    radiusScale: [],
    fontSizeScale: [],
    textStyles: [],
    paintStyles: [],
    paintStyleByKey: new Map(),
    libraries: [],
    warnings: [],
    pageOf: new Map(),
    ancestorsCache: new Map(),
    backgroundCache: new Map(),
    componentSets: [],
    localComponents: [],
    anySetHasReactions: false,
    found: {},
    reportProgress,
    isCancelled,
  };
}

const MAX_LIBRARY_VARIABLES = 800;

/** Indexe variables et styles locaux, puis (optionnel) les variables des librairies activées. */
export async function indexTokens(ctx: ScanContext): Promise<void> {
  const collectionCache = new Map<string, VariableCollection | null>();
  ctx.reportProgress({ phase: 'indexing', detail: 'local' });

  const [localVars, paintStyles, textStyles] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
  ]);
  let i = 0;
  for (const v of localVars) {
    if (v.resolvedType !== 'COLOR' && v.resolvedType !== 'FLOAT') continue;
    await indexVariable(ctx, v, 'Local', collectionCache);
    if (++i % 60 === 0) {
      await yieldToHost();
      if (ctx.isCancelled()) return;
    }
  }
  for (const s of paintStyles) await indexPaintStyle(ctx, s);
  for (const s of textStyles) indexTextStyle(ctx, s);

  if (ctx.options.includeLibraries) {
    let imported = 0;
    try {
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      for (const col of collections) {
        if (ctx.isCancelled()) return;
        if (imported >= MAX_LIBRARY_VARIABLES) {
          ctx.warnings.push('library-cap');
          break;
        }
        ctx.reportProgress({ phase: 'indexing', detail: col.libraryName });
        if (!ctx.libraries.includes(col.libraryName)) ctx.libraries.push(col.libraryName);
        try {
          const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
          for (const lv of vars) {
            if (lv.resolvedType !== 'COLOR' && lv.resolvedType !== 'FLOAT') continue;
            if (imported >= MAX_LIBRARY_VARIABLES) break;
            try {
              const v = await figma.variables.importVariableByKeyAsync(lv.key);
              await indexVariable(ctx, v, col.libraryName, collectionCache);
            } catch {
              /* variable individuelle illisible : on continue */
            }
            if (++imported % 25 === 0) {
              await yieldToHost();
              if (ctx.isCancelled()) return;
            }
          }
        } catch {
          ctx.warnings.push(`library:${col.libraryName}`);
        }
      }
    } catch (e) {
      // Sans la permission « teamlibrary » dans le manifeste, l'API teamLibrary est inaccessible.
      const message = e instanceof Error ? e.message : String(e);
      ctx.warnings.push(/permission|manifest/i.test(message) ? 'libraries-no-permission' : 'libraries-unavailable');
    }
  }
  buildFloatScales(ctx);
}

/** Recalcule les échelles après apprentissage de styles supplémentaires (styles distants utilisés dans le fichier). */
export function rebuildScales(ctx: ScanContext) {
  buildFloatScales(ctx);
}

export function tokenSwatch(t: ColorToken | PaintStyleInfo): string {
  return rgbToHex(t.rgb, t.alpha);
}
