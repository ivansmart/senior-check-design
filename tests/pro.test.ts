import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headingLevel, labelCase, looksPrimitiveToken, looksSemanticToken, roleName } from '../src/shared/names';
import { CLASSIC_RULE_IDS, PRESETS, PRO_RULE_IDS, RULE_BY_ID, resolveActiveRules } from '../src/shared/rules-catalog';
import { computeCraftReadiness } from '../src/shared/score';
import { countVariables, resolveValue, toCss, toDtcg, toTailwind, type TokenModel } from '../src/shared/tokens-export';
import type { Issue } from '../src/shared/types';

test('le mode Classique exclut toutes les règles Pro, le mode Pro les garde', () => {
  const classic = resolveActiveRules('strict', [], [], 'classic');
  for (const id of PRO_RULE_IDS) assert.equal(classic.has(id), false, id);
  for (const id of CLASSIC_RULE_IDS) assert.equal(classic.has(id), true, id);
  const pro = resolveActiveRules('strict', [], [], 'pro');
  for (const id of PRO_RULE_IDS) assert.equal(pro.has(id), true, id);
  assert.ok(PRESETS.preflight.every((id) => RULE_BY_ID[id]));
  assert.ok(PRESETS.preflight.some((id) => id.startsWith('tokens/')));
});

test('heuristiques de nommage Pro', () => {
  assert.equal(looksPrimitiveToken('color/blue/500'), true);
  assert.equal(looksPrimitiveToken('gray-100'), true);
  assert.equal(looksPrimitiveToken('color/action/primary'), false);
  assert.equal(looksPrimitiveToken('neutral.900', 'Primitives'), true);
  assert.equal(looksSemanticToken('color/text/muted'), true);
  assert.equal(looksSemanticToken('blue/500'), false);
  assert.equal(headingLevel('Heading/H2'), 2);
  assert.equal(headingLevel('Title 1'), 1);
  assert.equal(headingLevel('Body/Md'), null);
  assert.equal(labelCase('ENREGISTRER'), 'upper');
  assert.equal(labelCase('Enregistrer les modifications'), 'sentence');
  assert.equal(labelCase('Enregistrer Les Modifications'), 'title');
  assert.equal(labelCase('enregistrer'), 'lower');
  assert.equal(roleName('Card 3'), 'card');
  assert.equal(roleName('List item copy 2'), 'list item');
});

const issue = (ruleId: string, severity: Issue['severity']): Issue => ({
  id: `${ruleId}::1:1::`,
  ruleId,
  category: 'craft',
  severity,
  nodeId: '1:1',
  nodeName: 'Button',
  nodeType: 'COMPONENT_SET',
  nodePath: [],
  pageId: '0:1',
  currentValue: '',
  fixSafety: 'none',
  status: 'open',
  groupKey: ruleId,
});

test('Craft Readiness : 100 sans issue, décroît par axe, jamais négatif', () => {
  assert.equal(computeCraftReadiness([], 3).total, 100);
  const some = computeCraftReadiness([issue('craft/missing-state', 'error'), issue('craft/missing-state', 'warning')], 3);
  const states = some.areas.find((a) => a.area === 'states')!;
  assert.ok(states.score < 50 && states.score > 0);
  assert.equal(some.areas.find((a) => a.area === 'motion')!.score, 15);
  const flooded = computeCraftReadiness(Array.from({ length: 40 }, (_, i) => ({ ...issue('craft/inconsistent-motion', 'error'), id: String(i) })), 3);
  assert.equal(flooded.areas.find((a) => a.area === 'motion')!.score, 0);
  assert.ok(flooded.total >= 0);
});

const model: TokenModel = {
  collections: [
    {
      name: 'Primitives',
      modes: [{ id: 'm1', name: 'Default' }],
      defaultModeId: 'm1',
      variables: [
        { name: 'blue/500', type: 'COLOR', scopes: ['ALL_SCOPES'], valuesByMode: { m1: { kind: 'color', hex: '#3380E5' } } },
        { name: 'space/16', type: 'FLOAT', scopes: ['GAP'], valuesByMode: { m1: { kind: 'number', value: 16 } } },
        { name: 'radius/8', type: 'FLOAT', scopes: ['CORNER_RADIUS'], valuesByMode: { m1: { kind: 'number', value: 8 } } },
      ],
    },
    {
      name: 'Semantic',
      modes: [
        { id: 'l', name: 'Light' },
        { id: 'd', name: 'Dark' },
      ],
      defaultModeId: 'l',
      variables: [
        {
          name: 'color/action/primary',
          type: 'COLOR',
          scopes: ['FRAME_FILL'],
          valuesByMode: { l: { kind: 'alias', collection: 'Primitives', name: 'blue/500' }, d: { kind: 'color', hex: '#7CC4FF' } },
        },
      ],
    },
  ],
};

test('export DTCG : groupes par collection, $type/$value, alias en référence', () => {
  const json = JSON.parse(toDtcg(model));
  assert.equal(json.primitives.blue['500'].$type, 'color');
  assert.equal(json.primitives.blue['500'].$value, '#3380E5');
  assert.equal(json.semantic.color.action.primary.$value, '{primitives.blue.500}');
  assert.equal(json.semantic.color.action.primary.$extensions['com.figma'].modes.Dark, '#7CC4FF');
  assert.equal(countVariables(model), 4);
});

test('export CSS : :root pour le mode par défaut, bloc par thème, alias en var()', () => {
  const css = toCss(model);
  assert.match(css, /--primitives-blue-500: #3380E5;/);
  assert.match(css, /--primitives-space-16: 16px;/);
  assert.match(css, /--semantic-color-action-primary: var\(--primitives-blue-500\);/);
  assert.match(css, /\[data-theme="dark"\] \{[\s\S]*--semantic-color-action-primary: #7CC4FF;/);
});

test('export Tailwind : couleurs imbriquées et nombres répartis, alias résolus', () => {
  const tw = toTailwind(model);
  assert.match(tw, /module\.exports/);
  assert.match(tw, /"blue": \{\s*"500": "#3380E5"/);
  assert.match(tw, /"action": \{\s*"primary": "#3380E5"/);
  assert.match(tw, /"spacing": \{\s*"16": "16px"/);
  assert.match(tw, /"borderRadius": \{\s*"8": "8px"/);
  const sem = model.collections[1];
  assert.deepEqual(resolveValue(model, sem, sem.variables[0], 'd'), { kind: 'color', hex: '#7CC4FF' });
});
