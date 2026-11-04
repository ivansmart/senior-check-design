import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeScore, countBySeverity, countSafeFixes } from '../src/shared/score';
import type { Issue } from '../src/shared/types';

const mk = (severity: Issue['severity'], status: Issue['status'] = 'open', fixSafety: Issue['fixSafety'] = 'none'): Issue => ({
  id: Math.random().toString(36),
  ruleId: 'x/y',
  category: 'colors',
  severity,
  nodeId: '1:1',
  nodeName: 'n',
  nodeType: 'FRAME',
  nodePath: [],
  pageId: '0:1',
  currentValue: '',
  fixSafety,
  status,
  groupKey: 'g',
});

test('score : 100 sans issue, décroît avec la densité', () => {
  assert.equal(computeScore([], 100).total, 100);
  const tenErrorsOn100 = Array.from({ length: 10 }, () => mk('error'));
  const s = computeScore(tenErrorsOn100, 100).total;
  assert.ok(s > 40 && s < 50, String(s));
  const fixed = tenErrorsOn100.map((i) => ({ ...i, status: 'fixed' as const }));
  assert.equal(computeScore(fixed, 100).total, 100);
});

test('score : les infos pèsent moins que les erreurs', () => {
  const infos = Array.from({ length: 10 }, () => mk('info'));
  const errors = Array.from({ length: 10 }, () => mk('error'));
  assert.ok(computeScore(infos, 100).total > computeScore(errors, 100).total);
});

test('compteurs', () => {
  const list = [mk('error'), mk('warning', 'open', 'safe'), mk('info', 'ignored'), mk('error', 'fixed', 'safe')];
  assert.deepEqual(countBySeverity(list), { error: 1, warning: 1, info: 0 });
  assert.equal(countSafeFixes(list), 1);
});
