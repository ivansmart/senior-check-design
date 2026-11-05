/// <reference types="@figma/plugin-typings" />
import type { RGB01 } from '../../shared/color';
import { colorKey, rgbToHex } from '../../shared/color';
import type { ScaleCandidate } from '../../shared/scale';
import type { Category, ScanOptions, ScanProgress, ScanScope } from '../../shared/types';
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

/** Issue « virtuelle » : porte sur une variable ou un style plutôt que sur un calque. */
export interface VirtualTarget {
  id: string;
  name: string;
  type: 'VARIABLE' | 'TEXT_STYLE' | 'PAINT_STYLE';
  path: string[];
}

/** Issue brute produite par une règle ; le moteur complète chemin, statut et identifiant. */
export interface RawIssue {
  ruleId: string;
  node?: SceneNode;
  virtual?: VirtualTarget;
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
  /** Composants recréés à la main (Pro) : cadres candidats. */
  lookalikeFrames: FrameNode[];
  /** Composants candidats (locaux, autres pages, librairie via les instances), par id ; voir scan/component-index. */
  componentPool: Map<string, { comp: ComponentNode; source: 'local' | 'otherPages' | 'library' }>;
  instanceLookups: { count: number; ms: number };
  /** Instances déjà interrogées (nom et taille) : mille instances d'un même bouton ne coûtent qu'une recherche. */
  instanceLookupKeys: Set<string>;
  componentIndex: import('./component-index').ComponentIndex | null;
  /** Détachés dont le composant d'origine est introuvable : candidats à la ressemblance. */
  reattachMissingOrigin: Set<string>;
  /** Arbres de comparaison des composants candidats, calculés une fois par analyse (voir reattach-live). */
  componentTrees: Map<string, import('../../shared/reattach').TreeNode>;
  /** Composants de librairie importés par clé pendant l'analyse (null : import impossible). */
  importedComponents: Map<string, ComponentNode | null>;
  // ---- Pro ---------------------------------------------------------------
  scope: ScanScope;
  localVariables: Variable[];
  collectionsById: Map<string, VariableCollection>;
  /** Premier token couleur indexé par identifiant de variable (mode par défaut). */
  colorById: Map<string, ColorToken>;
  /** Variables liées rencontrées pendant le parcours (pour les tokens orphelins). */
  usedVariableIds: Set<string>;
  headings: { node: TextNode; level: number; rootId: string; y: number }[];
  textMetrics: { node: TextNode; family: string; size: number; lineHeightPx: number }[];
  buttonLabels: { node: TextNode; text: string }[];
  autoLayoutFrames: { node: SceneNode; role: string; mode: string; gap: number }[];
  destructiveNodes: SceneNode[];
  confirmPatternSeen: boolean;
  docLinkSeen: boolean;
  componentsForDocs: (ComponentNode | ComponentSetNode)[];
  /** Genre de composant par identifiant d'instance (évite plusieurs getMainComponentAsync par instance). */
  instanceKindCache: Map<string, string>;
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
    lookalikeFrames: [],
    componentPool: new Map(),
    instanceLookups: { count: 0, ms: 0 },
    instanceLookupKeys: new Set(),
    componentIndex: null,
    reattachMissingOrigin: new Set(),
    componentTrees: new Map(),
    importedComponents: new Map(),
    scope: 'page',
    localVariables: [],
    collectionsById: new Map(),
    colorById: new Map(),
    usedVariableIds: new Set(),
    headings: [],
    textMetrics: [],
    buttonLabels: [],
    autoLayoutFrames: [],
    destructiveNodes: [],
    confirmPatternSeen: false,
    docLinkSeen: false,
    componentsForDocs: [],
    instanceKindCache: new Map(),
    found: {},
    reportProgress,
    isCancelled,
  };
}

const MAX_LIBRARY_VARIABLES = 800;
/** Imports de variables de librairie lancés en parallèle (chaque import est une requête réseau). */
const IMPORT_BATCH = 40;
/**
 * Variables de librairie déjà importées pendant cette ouverture du plugin, par clé.
 * L'import est la partie lente d'une analyse sur un fichier relié à une librairie (une dizaine de
 * secondes) : une relance sur une sélection ne doit pas la repayer. Un import raté n'est pas mémorisé.
 */
const importedLibraryVariables = new Map<string, Variable>();

async function importLibraryVariable(key: string): Promise<Variable | null> {
  const cached = importedLibraryVariables.get(key);
  if (cached) {
    try {
      // Une variable mémorisée peut avoir été invalidée (librairie retirée) : on vérifie qu'elle se lit encore.
      void cached.valuesByMode;
      return cached;
    } catch {
      importedLibraryVariables.delete(key);
    }
  }
  try {
    const variable = await figma.variables.importVariableByKeyAsync(key);
    importedLibraryVariables.set(key, variable);
    return variable;
  } catch {
    return null; // variable individuelle illisible : on continue
  }
}

/** Indexe variables et styles locaux, puis (optionnel) les variables des librairies activées. */
export async function indexTokens(ctx: ScanContext): Promise<void> {
  const collectionCache = new Map<string, VariableCollection | null>();
  ctx.reportProgress({ phase: 'indexing', detail: 'local' });

  const [localVars, paintStyles, textStyles] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
  ]);
  ctx.localVariables = localVars;
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
    try {
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      if (collections.length) ctx.reportProgress({ phase: 'indexing', detail: collections[0].libraryName });
      // 1. Les listes de variables de toutes les collections, en parallèle (une requête par collection).
      const listed = await Promise.all(
        collections.map(async (col) => {
          try {
            const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
            return { col, vars: vars.filter((lv) => lv.resolvedType === 'COLOR' || lv.resolvedType === 'FLOAT') };
          } catch {
            ctx.warnings.push(`library:${col.libraryName}`);
            return { col, vars: [] as LibraryVariable[] };
          }
        }),
      );
      if (ctx.isCancelled()) return;
      const queue: { key: string; libraryName: string }[] = [];
      for (const { col, vars } of listed) {
        if (!vars.length) continue;
        if (!ctx.libraries.includes(col.libraryName)) ctx.libraries.push(col.libraryName);
        for (const lv of vars) queue.push({ key: lv.key, libraryName: col.libraryName });
      }
      if (queue.length > MAX_LIBRARY_VARIABLES) {
        ctx.warnings.push('library-cap');
        queue.length = MAX_LIBRARY_VARIABLES;
      }
      // 2. Les imports par lots parallèles : c'est la partie lente (réseau), le séquentiel multipliait les allers-retours.
      for (let i = 0; i < queue.length; i += IMPORT_BATCH) {
        const batch = queue.slice(i, i + IMPORT_BATCH);
        ctx.reportProgress({ phase: 'indexing', detail: batch[0].libraryName, scanned: i, total: queue.length });
        const imported = await Promise.all(
          batch.map(async ({ key, libraryName }) => {
            const variable = await importLibraryVariable(key);
            return variable ? { variable, libraryName } : null;
          }),
        );
        for (const entry of imported) {
          if (!entry) continue;
          try {
            await indexVariable(ctx, entry.variable, entry.libraryName, collectionCache);
          } catch {
            // Variable mémorisée devenue illisible : on l'oublie, le prochain passage la réimportera.
            importedLibraryVariables.delete(entry.variable.key);
          }
        }
        await yieldToHost();
        if (ctx.isCancelled()) return;
      }
      if (queue.length) ctx.reportProgress({ phase: 'indexing', detail: queue[queue.length - 1].libraryName, scanned: queue.length, total: queue.length });
    } catch (e) {
      // Sans la permission « teamlibrary » dans le manifeste, l'API teamLibrary est inaccessible.
      const message = e instanceof Error ? e.message : String(e);
      ctx.warnings.push(/permission|manifest/i.test(message) ? 'libraries-no-permission' : 'libraries-unavailable');
    }
  }
  for (const [id, col] of collectionCache) if (col) ctx.collectionsById.set(id, col);
  for (const t of ctx.colors) if (!ctx.colorById.has(t.id) || t.isDefaultMode) ctx.colorById.set(t.id, t);
  buildFloatScales(ctx);
}

/** Recalcule les échelles après apprentissage de styles supplémentaires (styles distants utilisés dans le fichier). */
export function rebuildScales(ctx: ScanContext) {
  buildFloatScales(ctx);
}

export function tokenSwatch(t: ColorToken | PaintStyleInfo): string {
  return rgbToHex(t.rgb, t.alpha);
}
