import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WINDOW_MAX_W, WINDOW_MIN_H, clampWindow, sanitizeOptions, sanitizeSettings } from '../src/shared/settings';
import { DEFAULT_SETTINGS } from '../src/shared/types';

test('réglages absents, nuls ou d’un autre type : valeurs par défaut', () => {
  assert.deepEqual(sanitizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings('oui'), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings(42), DEFAULT_SETTINGS);
});

test('langue : mémorisée si connue, sinon celle du navigateur', () => {
  assert.equal(sanitizeSettings({ locale: 'en' }, 'fr').locale, 'en');
  assert.equal(sanitizeSettings({}, 'en').locale, 'en');
  assert.equal(sanitizeSettings({ locale: 'de' }, 'en').locale, 'en');
});

test('valeurs inconnues ou corrompues : chaque champ retombe seul sur sa valeur par défaut', () => {
  const s = sanitizeSettings({
    mode: 'ultra',
    preset: 'nope',
    scope: 'everything',
    autoApply: 'maybe',
    theme: 'blue',
    compareTheme: 1,
    showRowCounts: 'yes',
    showContrast: false,
    disabledRules: ['colors/hardcoded-fill', 'unknown/rule', 7, 'colors/hardcoded-fill'],
    enabledRules: 'all',
    window: { width: '9999', height: -5 },
    options: { baseGrid: 6, spacingTolerance: 99, minTouchTarget: 'x', minFontSize: 11.6, contrastLevel: 'AAAA', ignoreHidden: 'non', componentsFromAllPages: false },
  });
  assert.equal(s.mode, 'classic');
  assert.equal(s.preset, 'quick');
  assert.equal(s.scope, 'auto');
  assert.equal(s.autoApply, 'exact');
  assert.equal(s.theme, 'auto');
  assert.equal(s.compareTheme, 'auto');
  assert.equal(s.showRowCounts, true);
  assert.equal(s.showContrast, false);
  assert.deepEqual(s.disabledRules, ['colors/hardcoded-fill']);
  assert.deepEqual(s.enabledRules, []);
  assert.deepEqual(s.window, { width: WINDOW_MAX_W, height: WINDOW_MIN_H });
  assert.equal(s.options.baseGrid, 4);
  assert.equal(s.options.spacingTolerance, 12);
  assert.equal(s.options.minTouchTarget, DEFAULT_SETTINGS.options.minTouchTarget);
  assert.equal(s.options.minFontSize, 12);
  assert.equal(s.options.contrastLevel, 'AA');
  assert.equal(s.options.ignoreHidden, true);
  assert.equal(s.options.componentsFromAllPages, false);
});

test('un preset réservé au mode Pro ne survit pas au mode Classique', () => {
  assert.equal(sanitizeSettings({ mode: 'classic', preset: 'preflight' }).preset, 'design-system');
  assert.equal(sanitizeSettings({ mode: 'pro', preset: 'preflight' }).preset, 'preflight');
});

test('des réglages valides sont conservés tels quels', () => {
  const valid = {
    ...DEFAULT_SETTINGS,
    locale: 'en' as const,
    mode: 'pro' as const,
    preset: 'strict' as const,
    scope: 'page' as const,
    options: { ...DEFAULT_SETTINGS.options, baseGrid: 8 as const, contrastLevel: 'AAA' as const, spacingTolerance: 3 },
    disabledRules: ['a11y/text-too-small'],
    enabledRules: ['tokens/orphan'],
    autoApply: 'close' as const,
    theme: 'dark' as const,
    compareTheme: 'light' as const,
    window: { width: 720, height: 800 },
  };
  assert.deepEqual(sanitizeSettings(valid), valid);
  assert.deepEqual(sanitizeOptions(valid.options), valid.options);
  assert.deepEqual(clampWindow(720, 800), { width: 720, height: 800 });
});
