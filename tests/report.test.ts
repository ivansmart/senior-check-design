import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCsvReport, buildMarkdownReport, type ReportLabels } from '../src/shared/report';
import type { Issue, ScanStats } from '../src/shared/types';

const labels: ReportLabels = {
  title: 'Senior Check Design',
  generated: 'Generated',
  scope: 'Scope',
  nodes: 'Layers',
  duration: 'Duration',
  score: 'Design Health',
  summary: 'Summary',
  category: (c) => c,
  severity: (s) => s,
  rule: (r) => r,
  message: (i) => i.currentValue,
  status: (s) => s,
  columns: { rule: 'Rule', severity: 'Severity', category: 'Category', layer: 'Layer', path: 'Path', current: 'Current', suggested: 'Suggested', status: 'Status', fix: 'Fix' },
  fixSafety: (f) => f,
  noIssues: 'No issue',
  occurrences: (n) => `${n} occurrences`,
};

const stats: ScanStats = {
  nodesScanned: 120,
  durationMs: 1234,
  scope: 'page',
  scopeLabel: 'Home',
  pagesScanned: 1,
  tokens: { colorVariables: 10, floatVariables: 5, textStyles: 3, paintStyles: 0, libraries: 1 },
  warnings: [],
};

const issue: Issue = {
  id: 'colors/hardcoded-fill::1:2::fills[0]',
  ruleId: 'colors/hardcoded-fill',
  category: 'colors',
  severity: 'error',
  nodeId: '1:2',
  nodeName: 'Price | badge',
  nodeType: 'FRAME',
  nodePath: ['Home', 'Card'],
  pageId: '0:1',
  currentValue: '#FF6633',
  suggestion: { kind: 'variable', id: 'v1', label: 'color/brand, "primary"', confidence: 'exact' },
  fixSafety: 'safe',
  status: 'open',
  groupKey: 'g',
};

test('markdown : échappe les pipes et contient le score', () => {
  const md = buildMarkdownReport([issue], stats, { total: 78, byCategory: {} }, labels, 'My file', new Date('2026-11-04T10:00:00Z'));
  assert.match(md, /Design Health : 78 \/ 100/);
  assert.match(md, /Price \\\| badge/);
  assert.match(md, /#FF6633/);
});

test('csv : guillemets et virgules échappés', () => {
  const csv = buildCsvReport([issue], labels);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /"color\/brand, ""primary"""/);
});
