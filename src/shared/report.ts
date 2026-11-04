import type { Category, Issue, ScanStats, ScoreBreakdown, Severity } from './types';
import { CATEGORIES } from './types';

export interface ReportLabels {
  title: string;
  generated: string;
  scope: string;
  nodes: string;
  duration: string;
  score: string;
  summary: string;
  category: (c: Category) => string;
  severity: (s: Severity) => string;
  rule: (ruleId: string) => string;
  message: (issue: Issue) => string;
  status: (s: Issue['status']) => string;
  columns: { rule: string; severity: string; category: string; layer: string; path: string; current: string; suggested: string; status: string; fix: string };
  fixSafety: (f: Issue['fixSafety']) => string;
  noIssues: string;
  occurrences: (n: number) => string;
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function buildMarkdownReport(issues: Issue[], stats: ScanStats, score: ScoreBreakdown, L: ReportLabels, fileName: string, date: Date): string {
  const open = issues.filter((i) => i.status !== 'ignored');
  const lines: string[] = [];
  lines.push(`# ${L.title} · ${fileName}`);
  lines.push('');
  lines.push(`- ${L.generated} : ${date.toISOString().slice(0, 16).replace('T', ' ')}`);
  lines.push(`- ${L.scope} : ${stats.scopeLabel}`);
  lines.push(`- ${L.nodes} : ${stats.nodesScanned}`);
  lines.push(`- ${L.duration} : ${(stats.durationMs / 1000).toFixed(1)} s`);
  lines.push(`- **${L.score} : ${score.total} / 100**`);
  lines.push('');
  lines.push(`## ${L.summary}`);
  lines.push('');
  lines.push(`| ${L.columns.category} | ${L.severity('error')} | ${L.severity('warning')} | ${L.severity('info')} |`);
  lines.push('| :-- | --: | --: | --: |');
  for (const cat of CATEGORIES) {
    const of = open.filter((i) => i.category === cat && i.status === 'open');
    if (!of.length) continue;
    const c = (s: Severity) => of.filter((i) => i.severity === s).length;
    lines.push(`| ${L.category(cat)} | ${c('error')} | ${c('warning')} | ${c('info')} |`);
  }
  lines.push('');
  if (!open.length) {
    lines.push(L.noIssues);
    return lines.join('\n');
  }
  for (const cat of CATEGORIES) {
    const ofCat = open.filter((i) => i.category === cat);
    if (!ofCat.length) continue;
    lines.push(`## ${L.category(cat)} (${ofCat.length})`);
    lines.push('');
    const byRule = new Map<string, Issue[]>();
    for (const i of ofCat) byRule.set(i.ruleId, [...(byRule.get(i.ruleId) ?? []), i]);
    for (const [ruleId, list] of byRule) {
      lines.push(`### ${L.rule(ruleId)} · ${L.occurrences(list.length)}`);
      lines.push('');
      lines.push(`| ${L.columns.severity} | ${L.columns.layer} | ${L.columns.current} | ${L.columns.suggested} | ${L.columns.status} |`);
      lines.push('| :-- | :-- | :-- | :-- | :-- |');
      for (const i of list) {
        const path = [...i.nodePath, i.nodeName].map(mdEscape).join(' › ');
        lines.push(
          `| ${L.severity(i.severity)} | ${path} | ${mdEscape(i.currentValue)} | ${mdEscape(i.suggestion?.label ?? '')} | ${L.status(i.status)} |`,
        );
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function csvCell(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsvReport(issues: Issue[], L: ReportLabels): string {
  const header = [
    L.columns.rule,
    L.columns.severity,
    L.columns.category,
    L.columns.layer,
    L.columns.path,
    L.columns.current,
    L.columns.suggested,
    L.columns.fix,
    L.columns.status,
    'nodeId',
  ];
  const rows = issues.map((i) =>
    [
      L.rule(i.ruleId),
      L.severity(i.severity),
      L.category(i.category),
      i.nodeName,
      i.nodePath.join(' › '),
      i.currentValue,
      i.suggestion?.label ?? '',
      L.fixSafety(i.fixSafety),
      L.status(i.status),
      i.nodeId,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.map(csvCell).join(','), ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Résumé de revue (Pro) : une page pour le lead designer ou le PO
// ---------------------------------------------------------------------------

export interface ReviewLabels {
  title: string;
  generated: string;
  scope: string;
  nodes: string;
  health: string;
  craft: string;
  craftAreas: Record<'states' | 'feedback' | 'recovery' | 'motion', string>;
  overview: string;
  columns: { category: string; open: string; errors: string };
  category: (c: Category) => string;
  quickFixes: string;
  topRules: string;
  rule: (ruleId: string) => string;
  occurrences: (n: number) => string;
  nextSteps: string;
  nextStepFor: (c: Category) => string;
  allClear: string;
}

export interface CraftSummary {
  total: number;
  areas: { area: 'states' | 'feedback' | 'recovery' | 'motion'; score: number; max: number }[];
}

export function buildReviewSummary(issues: Issue[], stats: ScanStats, score: ScoreBreakdown, craft: CraftSummary | null, L: ReviewLabels, fileName: string, date: Date): string {
  const open = issues.filter((i) => i.status === 'open');
  const lines: string[] = [];
  lines.push(`# ${L.title} · ${fileName}`);
  lines.push('');
  lines.push(`- ${L.generated} : ${date.toISOString().slice(0, 16).replace('T', ' ')}`);
  lines.push(`- ${L.scope} : ${stats.scopeLabel}`);
  lines.push(`- ${L.nodes} : ${stats.nodesScanned}`);
  lines.push(`- **${L.health} : ${score.total} / 100**`);
  if (craft) {
    lines.push(`- **${L.craft} : ${craft.total} / 100** · ${craft.areas.map((a) => `${L.craftAreas[a.area]} ${a.score}/${a.max}`).join(' · ')}`);
  }
  lines.push('');
  if (!open.length) {
    lines.push(L.allClear);
    return lines.join('\n') + '\n';
  }
  lines.push(`## ${L.overview}`);
  lines.push('');
  lines.push(`| ${L.columns.category} | ${L.columns.open} | ${L.columns.errors} |`);
  lines.push('| :-- | --: | --: |');
  const byCat = new Map<Category, { open: number; errors: number }>();
  for (const i of open) {
    const c = byCat.get(i.category) ?? { open: 0, errors: 0 };
    c.open++;
    if (i.severity === 'error') c.errors++;
    byCat.set(i.category, c);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1].errors - a[1].errors || b[1].open - a[1].open);
  for (const [cat, c] of cats) lines.push(`| ${L.category(cat)} | ${c.open} | ${c.errors} |`);
  lines.push('');
  lines.push(`- ${L.quickFixes} : ${open.filter((i) => i.fixSafety === 'safe').length}`);
  lines.push('');
  lines.push(`## ${L.topRules}`);
  lines.push('');
  const byRule = new Map<string, number>();
  for (const i of open) byRule.set(i.ruleId, (byRule.get(i.ruleId) ?? 0) + 1);
  for (const [ruleId, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) lines.push(`1. ${L.rule(ruleId)} · ${L.occurrences(n)}`);
  lines.push('');
  lines.push(`## ${L.nextSteps}`);
  lines.push('');
  for (const [cat] of cats.slice(0, 3)) lines.push(`- ${L.nextStepFor(cat)}`);
  return lines.join('\n') + '\n';
}
