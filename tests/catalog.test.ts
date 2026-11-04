import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_RULE_IDS, PRESETS, RULE_BY_ID, resolveActiveRules } from '../src/shared/rules-catalog';
import { DICTIONARIES } from '../src/ui/i18n';

test('chaque preset ne référence que des règles existantes', () => {
  for (const [preset, ids] of Object.entries(PRESETS)) {
    for (const id of ids) assert.ok(RULE_BY_ID[id], `${preset} → ${id}`);
  }
  assert.equal(PRESETS.strict.length, ALL_RULE_IDS.length);
});

test('chaque règle a sa copie FR et EN', () => {
  for (const locale of ['fr', 'en'] as const) {
    for (const id of ALL_RULE_IDS) {
      const copy = DICTIONARIES[locale].rules[id];
      assert.ok(copy, `${locale} ${id}`);
      assert.ok(copy.title && copy.message && copy.why && copy.suggestion, `${locale} ${id} incomplete`);
    }
  }
});

test('les deux dictionnaires UI ont les mêmes clés', () => {
  const fr = Object.keys(DICTIONARIES.fr.ui).sort();
  const en = Object.keys(DICTIONARIES.en.ui).sort();
  assert.deepEqual(fr, en);
});

test('resolveActiveRules applique désactivations et activations', () => {
  const set = resolveActiveRules('quick', ['colors/hardcoded-fill'], ['a11y/text-contrast']);
  assert.equal(set.has('colors/hardcoded-fill'), false);
  assert.equal(set.has('a11y/text-contrast'), true);
  assert.equal(set.has('colors/hardcoded-stroke'), true);
});
