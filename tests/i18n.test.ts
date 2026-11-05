import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Issue } from '../src/shared/types';
import { I18n } from '../src/ui/i18n';

const reattach = (params: Record<string, string | number>, suggestion?: Issue['suggestion']): Issue => ({
  id: 'components/reattach-instance::1:1::',
  ruleId: 'components/reattach-instance',
  category: 'components',
  severity: 'warning',
  nodeId: '1:1',
  nodeName: 'Badge',
  nodeType: 'FRAME',
  nodePath: ['UI'],
  pageId: '1:0',
  currentValue: 'Badge',
  fixSafety: 'review',
  params,
  status: 'open',
  groupKey: 'g',
  suggestion,
});

const fr = new I18n('fr');
const en = new I18n('en');

test('équivalent de même nom (origine de librairie inaccessible) : phrase dédiée, exacte ou proche', () => {
  const close = reattach({ confidence: 'close', via: 'name', component: 'Badges', total: 1, texts: 1, visibility: 0, paints: 0, origin: 'library' });
  assert.match(fr.ruleMessage(close), /connu de ce fichier sous le même nom/);
  assert.match(fr.ruleMessage(close), /« Badges »/);
  assert.match(fr.ruleMessage(close), /1 overrides/);
  assert.match(en.ruleMessage(close), /known to this file under the same name/);
  const exact = reattach({ confidence: 'exact', via: 'name', component: 'Badges', total: 0, origin: 'library' });
  assert.match(fr.ruleMessage(exact), /reproduit son contenu à l’identique/);
  // La suggestion reste celle des rattachements ordinaires.
  assert.match(fr.ruleSuggestion(exact), /Remplacer par une instance/);
});

test('équivalent de même nom à structure divergente : rattachement forcé, par arbre ou par contenu', () => {
  const forced = reattach({ confidence: 'forced', via: 'name', match: 'tree', component: 'Alert / Type=Information', detail: 'Icon', extras: 1, hidden: 0, total: 2, texts: 1, visibility: 0, paints: 0, origin: 'library' });
  assert.match(fr.ruleMessage(forced), /connu de ce fichier sous le même nom, en diverge \(Icon\)/);
  assert.match(fr.ruleMessage(forced), /1 calque\(s\) ajouté\(s\)/);
  assert.match(fr.ruleSuggestion(forced), /Inclure quand même/);
  const content = reattach({ confidence: 'forced', via: 'name', match: 'content', component: 'Alert / Type=Information', detail: '', extras: 0, hidden: 2, total: 3, texts: 2, visibility: 0, paints: 0, origin: 'library' });
  assert.match(fr.ruleMessage(content), /a une autre structure\. Rattachable par son contenu : 2 texte\(s\)/);
  assert.match(en.ruleMessage(content), /has a different structure\. Re-attachable by content/);
});

test('origine de librairie introuvable : motif explicite, sans message brut de l’API', () => {
  const none = reattach({ confidence: 'none', reason: 'component-unpublished', detail: 'Component with key "abc" not found', origin: 'library' });
  assert.match(fr.ruleMessage(none), /ne retrouve pas/);
  assert.match(fr.ruleMessage(none), /aucun composant connu du fichier ne porte ce nom/);
  assert.doesNotMatch(fr.ruleMessage(none), /Component with key/);
  assert.match(fr.ruleSuggestion(none), /Publier \(ou republier\) la librairie/);
  const diverged = reattach({ confidence: 'none', reason: 'component-unpublished-diverged', detail: 'Alert / Type=Information', origin: 'library' });
  assert.match(fr.ruleMessage(diverged), /« Alert \/ Type=Information » porte le même nom dans ce fichier mais sa structure diffère/);
  assert.match(en.ruleMessage(diverged), /carries the same name in this file but its structure differs/);
  const detail = reattach({ confidence: 'none', reason: 'component-missing-detail', detail: 'Network error', origin: 'library' });
  assert.match(fr.ruleMessage(detail), /n’a pas pu être chargé : Network error/);
});

test('aucun tiret cadratin dans les textes du plugin (français et anglais)', () => {
  const walk = (value: unknown, path: string, out: string[]) => {
    if (typeof value === 'string') {
      if (value.includes('—')) out.push(path);
    } else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, `${path}.${k}`, out);
  };
  for (const locale of ['fr', 'en'] as const) {
    const found: string[] = [];
    walk(new I18n(locale).d, locale, found);
    assert.deepEqual(found, []);
  }
});
