/**
 * Types partagés entre le sandbox (code.js) et l'UI (ui.html).
 * Ce fichier ne doit référencer ni l'API Figma ni le DOM.
 */

export type Category =
  | 'colors'
  | 'typography'
  | 'spacing'
  | 'radius'
  | 'components'
  | 'tokens'
  | 'craft'
  | 'a11y'
  | 'handoff';

export const CATEGORIES: Category[] = [
  'colors',
  'typography',
  'spacing',
  'radius',
  'components',
  'tokens',
  'craft',
  'a11y',
  'handoff',
];

/** Classique : la V1 ; Pro : active les règles et fonctions de la V2 (« Senior Check »). */
export type PluginMode = 'classic' | 'pro';

export type Severity = 'error' | 'warning' | 'info';

/** `safe` : correction automatisable sans risque. `review` : correction possible mais décision humaine. `none` : pas de correction automatique. */
export type FixSafety = 'safe' | 'review' | 'none';

export type MatchConfidence = 'exact' | 'close' | 'ambiguous' | 'none';

export type IssueStatus = 'open' | 'fixed' | 'ignored';

export type ScanScope = 'selection' | 'page' | 'file';

/** Réglage utilisateur du périmètre : « auto » = sélection si elle existe, sinon page active. */
export type ScopeSetting = 'auto' | 'page' | 'file';

export type ContrastLevel = 'AA' | 'AAA';

export type PresetId = 'quick' | 'handoff' | 'design-system' | 'a11y' | 'craft' | 'preflight' | 'strict';

export type Locale = 'fr' | 'en';

/** Lignes incluses dans « Appliquer » quand rien n'est sélectionné : exactes seules, + proches, ou toutes (y compris ambiguës). */
export type AutoApplyLevel = 'exact' | 'close' | 'all';

export interface SuggestionAlternative {
  id: string;
  label: string;
  /** Couleur hex (#RRGGBB) pour la pastille, quand pertinent. */
  swatch?: string;
  /** Valeur numérique ou textuelle lisible. */
  value?: string;
}

export interface Suggestion {
  kind: 'variable' | 'style' | 'value' | 'component';
  /** Identifiant Figma (variable, style) ou valeur sérialisée. */
  id: string;
  label: string;
  swatch?: string;
  value?: string;
  confidence: MatchConfidence;
  /** Détail de la source : "Local", nom de collection ou de librairie. */
  source?: string;
  alternatives?: SuggestionAlternative[];
}

export interface Issue {
  /** Identifiant stable : `${ruleId}::${nodeId}::${slot}`. */
  id: string;
  ruleId: string;
  category: Category;
  severity: Severity;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  /** Chemin lisible : page › frame › … › parent. */
  nodePath: string[];
  pageId: string;
  /** Valeur actuelle, lisible et neutre (hex, "18 px", "Inter Medium 15/22"). */
  currentValue: string;
  /** Pastille couleur pour la valeur actuelle. */
  swatch?: string;
  suggestion?: Suggestion;
  fixSafety: FixSafety;
  /** Paramètres pour les templates de message (UI). */
  params?: Record<string, string | number>;
  status: IssueStatus;
  /** Clé de regroupement : `${ruleId}|${currentValue}`. */
  groupKey: string;
}

export interface ScanOptions {
  ignoreHidden: boolean;
  ignoreLocked: boolean;
  scanInsideInstances: boolean;
  includeLibraries: boolean;
  /** Grille de base utilisée quand aucun token d'espacement n'existe. */
  baseGrid: 4 | 8;
  /** Tolérance (px) pour une correspondance "proche" d'espacement. */
  spacingTolerance: number;
  /** Taille minimale d'une zone interactive. */
  minTouchTarget: number;
  /** Taille minimale de texte (info en dessous). */
  minFontSize: number;
  /** Niveau WCAG exigé pour le contraste texte/fond. */
  contrastLevel: ContrastLevel;
}

export interface Settings {
  locale: Locale;
  /** Classique (V1) ou Pro (V2). */
  mode: PluginMode;
  preset: PresetId;
  scope: ScopeSetting;
  options: ScanOptions;
  /** Afficher le nombre de calques par ligne. */
  showRowCounts: boolean;
  /** Inclure les suggestions de contraste dans l'onglet Couleurs. */
  showContrast: boolean;
  /** Règles désactivées par l'utilisateur. */
  disabledRules: string[];
  /** Règles activées en plus du preset. */
  enabledRules: string[];
  /** Niveau de correspondance appliqué sans sélection explicite. */
  autoApply: AutoApplyLevel;
  /** Volet Comparer : rendre l'élément sélectionné sur le canvas (sinon les cadres concernés). */
  compareFollowsSelection: boolean;
  /** Taille de la colonne principale (hors volet Comparer). */
  window: { width: number; height: number };
}

export const DEFAULT_OPTIONS: ScanOptions = {
  ignoreHidden: true,
  ignoreLocked: true,
  scanInsideInstances: false,
  includeLibraries: true,
  baseGrid: 4,
  spacingTolerance: 2,
  minTouchTarget: 24,
  minFontSize: 12,
  contrastLevel: 'AA',
};

export const DEFAULT_SETTINGS: Settings = {
  locale: 'fr',
  mode: 'classic',
  preset: 'quick',
  scope: 'auto',
  options: DEFAULT_OPTIONS,
  showRowCounts: true,
  showContrast: true,
  disabledRules: [],
  enabledRules: [],
  autoApply: 'exact',
  compareFollowsSelection: true,
  window: { width: 680, height: 640 },
};

export interface CategoryCount {
  category: Category;
  open: number;
  errors: number;
  warnings: number;
  infos: number;
}

export interface ScanStats {
  nodesScanned: number;
  durationMs: number;
  scope: ScanScope;
  scopeLabel: string;
  pagesScanned: number;
  /** Composants interactifs (jeux de variantes avec états) rencontrés : base du score Craft Readiness. */
  interactiveComponents: number;
  /** Indices disponibles pendant le scan, pour expliquer les suggestions. */
  tokens: {
    colorVariables: number;
    floatVariables: number;
    textStyles: number;
    paintStyles: number;
    libraries: number;
  };
  /** Avertissements non bloquants (librairie illisible, etc.). */
  warnings: string[];
}

export interface ScoreBreakdown {
  total: number;
  byCategory: Partial<Record<Category, number>>;
}

export interface ScanResult {
  issues: Issue[];
  stats: ScanStats;
}

/** Progression envoyée pendant le scan. */
export interface ScanProgress {
  phase: 'indexing' | 'collecting' | 'scanning' | 'finalizing';
  scanned: number;
  total: number;
  /** Compteurs d'issues par catégorie, pour l'effet de remplissage progressif. */
  found: Partial<Record<Category, number>>;
  /** Détail de phase (ex: nom de la librairie lue). */
  detail?: string;
}

// ---------------------------------------------------------------------------
// Messages UI → sandbox
// ---------------------------------------------------------------------------

export type UiToPluginMessage =
  | { type: 'ui-ready' }
  | { type: 'scan'; scope: ScanScope; preset: PresetId; options: ScanOptions; disabledRules: string[]; enabledRules: string[]; mode: PluginMode }
  | { type: 'cancel-scan' }
  | { type: 'select-node'; nodeId: string; pageId: string }
  | { type: 'select-nodes'; nodeIds: string[]; pageId: string }
  | { type: 'fix'; issueId: string; alternativeId?: string }
  | { type: 'fix-many'; items: { issueId: string; alternativeId?: string }[] }
  | { type: 'undo'; batchId: string }
  | { type: 'ignore-issue'; issueId: string; ignored: boolean }
  | { type: 'save-settings'; settings: Partial<Settings> }
  /** `persist: false` pour une taille transitoire (fenêtre repliée). `baseWidth` : largeur de la colonne principale à mémoriser quand le volet Comparer est ouvert. */
  | { type: 'resize'; width: number; height: number; persist?: boolean; baseWidth?: number }
  /**
   * Rendu avant/après des corrections listées. Racines rendues : `rootId` si fourni, sinon la sélection du canvas
   * (si `followSelection`), sinon les cadres racines des calques concernés (au plus `maxRoots`).
   */
  | { type: 'preview'; requestId: number; items: { issueId: string; alternativeId?: string }[]; maxRoots: number; rootId?: string | null; followSelection: boolean }
  /** Pro : export des variables locales (DTCG JSON, CSS custom properties, Tailwind). */
  | { type: 'export-tokens'; format: TokenExportFormat }
  | { type: 'notify'; message: string; error?: boolean }
  | { type: 'open-url'; url: string };

export type TokenExportFormat = 'dtcg' | 'css' | 'tailwind';

// ---------------------------------------------------------------------------
// Messages sandbox → UI
// ---------------------------------------------------------------------------

export interface FixOutcome {
  issueId: string;
  ok: boolean;
  /** Explication en cas d'échec (clé i18n ou texte brut). */
  reason?: string;
}

/** Racine d'aperçu disponible : élément sélectionné ou cadre concerné, avec le nombre de corrections qu'il contient. */
export interface PreviewRoot {
  id: string;
  name: string;
  count: number;
  kind: 'selection' | 'frame';
}

/** Racine d'aperçu refusée : trop de calques ou surface trop grande pour cloner et exporter sans figer l'éditeur. */
export interface PreviewSkipped {
  id: string;
  name: string;
  nodes: number;
}

/** Un cadre racine rendu avant et après application des corrections (PNG). */
export interface PreviewFrame {
  rootId: string;
  name: string;
  /** Dimensions du cadre en px de design. */
  width: number;
  height: number;
  /** Échelle d'export : pixels image par px de design. */
  scale: number;
  before: Uint8Array;
  after: Uint8Array;
  /** Corrections appliquées sur le clone / impossibles à appliquer. */
  applied: number;
  failed: number;
  issueIds: string[];
}

export type PluginToUiMessage =
  | {
      type: 'init';
      settings: Settings;
      selectionCount: number;
      fileName: string;
      pageName: string;
      pageCount: number;
      ignoredIssueIds: string[];
      editorType: string;
    }
  /** `programmatic` : sélection posée par le plugin lui-même (« Voir dans le canvas »). */
  | { type: 'selection'; count: number; ids: string[]; programmatic: boolean }
  | { type: 'page-changed'; pageName: string }
  | { type: 'scan-progress'; progress: ScanProgress }
  | { type: 'scan-done'; result: ScanResult }
  | { type: 'scan-cancelled'; partial: ScanResult | null }
  | { type: 'scan-error'; message: string; partial: ScanResult | null }
  | { type: 'fix-done'; batchId: string; outcomes: FixOutcome[]; undoable: boolean }
  | { type: 'fix-progress'; done: number; total: number }
  | { type: 'undo-done'; batchId: string; issueIds: string[] }
  | { type: 'ignored-updated'; ignoredIssueIds: string[] }
  | { type: 'settings-saved'; settings: Settings }
  | { type: 'preview-done'; requestId: number; frames: PreviewFrame[]; skipped: number; roots: PreviewRoot[]; tooBig: PreviewSkipped[]; maxNodes: number }
  | { type: 'tokens-exported'; format: TokenExportFormat; content: string; variables: number }
  | { type: 'preview-error'; requestId: number; message: string };
