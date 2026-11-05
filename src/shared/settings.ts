/**
 * Validation des réglages mémorisés (clientStorage) ou importés (règles d'équipe).
 * Un réglage inconnu, d'un ancien format ou corrompu retombe sur sa valeur par défaut
 * plutôt que de laisser l'interface dans un état incohérent (preset absent du menu,
 * onglet d'un mode désactivé, taille de fenêtre impossible).
 * Pur : partagé entre le sandbox et l'UI, testé avec node:test.
 */
import { PRESET_IDS, PRO_PRESET_IDS, RULE_BY_ID } from './rules-catalog';
import { DEFAULT_SETTINGS, type AutoApplyLevel, type ContrastLevel, type Locale, type PluginMode, type PresetId, type ScanOptions, type ScopeSetting, type Settings, type ThemeSetting } from './types';

/** Bornes de la colonne principale de la fenêtre (hors volet Comparer). */
export const WINDOW_MIN_W = 560;
export const WINDOW_MIN_H = 400;
export const WINDOW_MAX_W = 1200;
export const WINDOW_MAX_H = 1400;

const LOCALES: Locale[] = ['fr', 'en'];
const MODES: PluginMode[] = ['classic', 'pro'];
const SCOPES: ScopeSetting[] = ['auto', 'page', 'file'];
const AUTO_APPLY: AutoApplyLevel[] = ['exact', 'close', 'all'];
const THEMES: ThemeSetting[] = ['auto', 'light', 'dark'];
const CONTRAST: ContrastLevel[] = ['AA', 'AAA'];

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback);
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const v = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : fallback;
};
const ruleIds = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string' && Boolean(RULE_BY_ID[x])))] : []);

export function clampWindow(width: unknown, height: unknown): { width: number; height: number } {
  return {
    width: num(width, DEFAULT_SETTINGS.window.width, WINDOW_MIN_W, WINDOW_MAX_W),
    height: num(height, DEFAULT_SETTINGS.window.height, WINDOW_MIN_H, WINDOW_MAX_H),
  };
}

export function sanitizeOptions(stored: unknown): ScanOptions {
  const o = (stored && typeof stored === 'object' ? stored : {}) as Partial<Record<keyof ScanOptions, unknown>>;
  const d = DEFAULT_SETTINGS.options;
  return {
    ignoreHidden: bool(o.ignoreHidden, d.ignoreHidden),
    ignoreLocked: bool(o.ignoreLocked, d.ignoreLocked),
    scanInsideInstances: bool(o.scanInsideInstances, d.scanInsideInstances),
    includeLibraries: bool(o.includeLibraries, d.includeLibraries),
    baseGrid: num(o.baseGrid, d.baseGrid, 4, 8) === 8 ? 8 : 4,
    spacingTolerance: num(o.spacingTolerance, d.spacingTolerance, 0, 12),
    minTouchTarget: num(o.minTouchTarget, d.minTouchTarget, 16, 64),
    minFontSize: num(o.minFontSize, d.minFontSize, 8, 16),
    contrastLevel: oneOf(o.contrastLevel, CONTRAST, d.contrastLevel),
    componentsFromAllPages: bool(o.componentsFromAllPages, d.componentsFromAllPages),
  };
}

/**
 * Réglages complets et cohérents à partir d'un objet quelconque.
 * `fallbackLocale` : langue déduite du navigateur quand aucune n'est mémorisée.
 */
export function sanitizeSettings(stored: unknown, fallbackLocale: Locale = DEFAULT_SETTINGS.locale): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Record<keyof Settings, unknown>>;
  const mode = oneOf(s.mode, MODES, DEFAULT_SETTINGS.mode);
  let preset = oneOf<PresetId>(s.preset, PRESET_IDS, DEFAULT_SETTINGS.preset);
  // Un preset réservé au mode Pro n'a pas de sens en Classique : on retombe sur le preset Classique le plus proche.
  if (mode === 'classic' && PRO_PRESET_IDS.includes(preset)) preset = 'design-system';
  const win = s.window && typeof s.window === 'object' ? (s.window as { width?: unknown; height?: unknown }) : {};
  return {
    locale: oneOf(s.locale, LOCALES, fallbackLocale),
    mode,
    preset,
    scope: oneOf(s.scope, SCOPES, DEFAULT_SETTINGS.scope),
    options: sanitizeOptions(s.options),
    showRowCounts: bool(s.showRowCounts, DEFAULT_SETTINGS.showRowCounts),
    showContrast: bool(s.showContrast, DEFAULT_SETTINGS.showContrast),
    disabledRules: ruleIds(s.disabledRules),
    enabledRules: ruleIds(s.enabledRules),
    autoApply: oneOf(s.autoApply, AUTO_APPLY, DEFAULT_SETTINGS.autoApply),
    compareFollowsSelection: bool(s.compareFollowsSelection, DEFAULT_SETTINGS.compareFollowsSelection),
    theme: oneOf(s.theme, THEMES, DEFAULT_SETTINGS.theme),
    compareTheme: oneOf(s.compareTheme, THEMES, DEFAULT_SETTINGS.compareTheme),
    window: clampWindow(win.width, win.height),
  };
}
