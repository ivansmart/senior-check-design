import { ALL_RULE_IDS, PRESET_IDS, RULE_BY_ID, RULES, resolveActiveRules } from '../shared/rules-catalog';
import { buildCsvReport, buildMarkdownReport, type ReportLabels } from '../shared/report';
import { computeScore, countBySeverity } from '../shared/score';
import {
  DEFAULT_SETTINGS,
  type Issue,
  type PluginToUiMessage,
  type ScanProgress,
  type ScanResult,
  type ScanScope,
  type Settings,
  type Severity,
  type UiToPluginMessage,
} from '../shared/types';
import { animateNumber, append, clear, copyText, download, el, svgIcon, type IconName } from './dom';
import { I18n, detectLocale } from './i18n';

// ---------------------------------------------------------------------------
// Modèle d'affichage : onglets, sections (contexte), lignes (valeur → suggestion)
// ---------------------------------------------------------------------------

type Tab = 'colors' | 'dimensions' | 'typography' | 'components' | 'craft' | 'a11y' | 'handoff';
const TABS: Tab[] = ['colors', 'dimensions', 'typography', 'components', 'craft', 'a11y', 'handoff'];
const BASE_TABS = 4; // les quatre onglets de Check designs ; les suivants sont l'extension « senior »

type Kind = 'frame' | 'componentSet' | 'component' | 'instance' | 'shape' | 'text' | 'group' | 'section' | 'layer';
const KIND_ORDER: Kind[] = ['frame', 'componentSet', 'component', 'instance', 'shape', 'text', 'group', 'section', 'layer'];
const KIND_ICON: Record<Kind, IconName> = {
  frame: 'frame',
  componentSet: 'component',
  component: 'component',
  instance: 'instance',
  shape: 'shape',
  text: 'text',
  group: 'group',
  section: 'section',
  layer: 'layers',
};

interface Row {
  key: string;
  tab: Tab;
  kind: Kind;
  prop: string; // clé i18n propXxx
  issues: Issue[];
  first: Issue;
  severity: Severity;
  status: 'open' | 'fixed' | 'ignored';
}

function kindOf(nodeType: string): Kind {
  switch (nodeType) {
    case 'FRAME':
      return 'frame';
    case 'COMPONENT_SET':
      return 'componentSet';
    case 'COMPONENT':
      return 'component';
    case 'INSTANCE':
      return 'instance';
    case 'TEXT':
      return 'text';
    case 'GROUP':
      return 'group';
    case 'SECTION':
      return 'section';
    case 'RECTANGLE':
    case 'ELLIPSE':
    case 'POLYGON':
    case 'STAR':
    case 'VECTOR':
    case 'LINE':
    case 'BOOLEAN_OPERATION':
      return 'shape';
    default:
      return 'layer';
  }
}

const PROP_BY_RULE: Record<string, string> = {
  'colors/hardcoded-fill': 'propFill',
  'colors/hardcoded-stroke': 'propStroke',
  'a11y/text-contrast': 'propContrast',
  'a11y/contrast-not-verifiable': 'propContrastNA',
  'spacing/off-scale-padding': 'propPadding',
  'spacing/off-scale-gap': 'propGap',
  'radius/not-tokenized': 'propRadius',
  'typography/no-text-style': 'propStyle',
  'typography/off-scale-size': 'propSize',
  'typography/mixed-styles': 'propMixed',
  'components/detached-instance': 'propDetached',
  'components/default-name': 'propName',
  'components/heavy-overrides': 'propOverrides',
  'components/no-description': 'propDescription',
  'components/duplicate-component': 'propDuplicate',
  'craft/missing-state': 'propState',
  'craft/missing-loading-state': 'propLoading',
  'craft/missing-empty-state': 'propEmpty',
  'craft/state-naming': 'propStateNaming',
  'craft/missing-hover-transition': 'propHoverTransition',
  'craft/inconsistent-motion': 'propMotion',
  'a11y/touch-target': 'propTouchTarget',
  'a11y/text-too-small': 'propTextSize',
  'handoff/fractional-size': 'propDims',
  'handoff/fractional-position': 'propPosition',
  'handoff/stackable-without-autolayout': 'propAutoLayout',
};
const PROP_ORDER = Object.keys(PROP_BY_RULE);

function tabOf(issue: Issue): Tab | null {
  const r = issue.ruleId;
  if (r.startsWith('colors/')) return 'colors';
  if (r === 'a11y/text-contrast' || r === 'a11y/contrast-not-verifiable') return state.settings.showContrast ? 'colors' : null;
  if (r.startsWith('spacing/') || r.startsWith('radius/')) return 'dimensions';
  if (r.startsWith('typography/')) return 'typography';
  if (r.startsWith('components/')) return 'components';
  if (r.startsWith('craft/')) return 'craft';
  if (r.startsWith('a11y/')) return 'a11y';
  if (r.startsWith('handoff/')) return 'handoff';
  return null;
}

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  timeout: number;
  error?: boolean;
}

interface Confirm {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const state = {
  phase: 'boot' as 'boot' | 'scanning' | 'results',
  settings: { ...DEFAULT_SETTINGS, locale: detectLocale() } as Settings,
  i18n: new I18n(detectLocale()),
  selectionCount: 0,
  fileName: '',
  pageName: '',
  pageCount: 1,
  progress: null as ScanProgress | null,
  result: null as ScanResult | null,
  issues: new Map<string, Issue>(),
  notice: null as null | { kind: 'cancelled' } | { kind: 'error'; message: string },
  tab: 'colors' as Tab,
  rows: [] as Row[],
  selected: new Set<string>(),
  anchorKey: null as string | null,
  chosen: new Map<string, string>(), // rowKey → alternativeId choisi dans le menu
  expanded: null as string | null,
  dropdown: null as string | null,
  showIgnored: false,
  menu: null as null | 'settings' | 'export',
  confirm: null as Confirm | null,
  toasts: [] as Toast[],
  toastSeq: 0,
  fixing: null as null | { done: number; total: number },
  pendingFixIds: new Set<string>(),
  justFixed: new Set<string>(),
  lastScore: 100,
  selectionChangedSinceScan: false,
  scannedSelection: false,
  rescanTimer: 0,
};

const app = document.getElementById('app')!;
const send = (msg: UiToPluginMessage) => parent.postMessage({ pluginMessage: msg }, '*');
const t = (key: string, vars?: Record<string, string | number | undefined>) => state.i18n.t(key, vars);

// ---------------------------------------------------------------------------
// Lignes
// ---------------------------------------------------------------------------

function buildRows(): Row[] {
  const groups = new Map<string, Issue[]>();
  for (const issue of state.issues.values()) {
    const tab = tabOf(issue);
    if (!tab) continue;
    const kind = kindOf(issue.nodeType);
    const prop = PROP_BY_RULE[issue.ruleId] ?? 'propName';
    const key = `${tab}|${kind}|${prop}|${issue.groupKey}`;
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  const sevRank: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  const rows: Row[] = [];
  for (const [key, issues] of groups) {
    const [tab, kind, prop] = key.split('|') as [Tab, Kind, string];
    const open = issues.filter((i) => i.status === 'open');
    const status: Row['status'] = open.length ? 'open' : issues.every((i) => i.status === 'ignored') ? 'ignored' : 'fixed';
    const first = open[0] ?? issues[0];
    const severity = issues.reduce<Severity>((acc, i) => (sevRank[i.severity] < sevRank[acc] ? i.severity : acc), 'info');
    rows.push({ key, tab, kind, prop, issues, first, severity, status });
  }
  rows.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      PROP_ORDER.indexOf(ruleOfProp(a)) - PROP_ORDER.indexOf(ruleOfProp(b)) ||
      sevRank[a.severity] - sevRank[b.severity] ||
      a.first.currentValue.localeCompare(b.first.currentValue),
  );
  return rows;
}

const ruleOfProp = (row: Row) => row.first.ruleId;

function rowsOf(tab: Tab, includeIgnored = state.showIgnored): Row[] {
  return state.rows.filter((r) => r.tab === tab && (includeIgnored || r.status !== 'ignored'));
}

function openRowsOf(tab: Tab): Row[] {
  return state.rows.filter((r) => r.tab === tab && r.status === 'open');
}

/** Suggestion effective d'une ligne (alternative choisie ou suggestion principale). */
function effectiveSuggestion(row: Row): { id?: string; label: string; swatch?: string; value?: string; confidence: string; kind?: string; altId?: string } | null {
  const s = row.first.suggestion;
  if (!s) return null;
  const altId = state.chosen.get(row.key);
  if (altId) {
    const alt = s.alternatives?.find((a) => a.id === altId);
    if (alt) return { id: alt.id, label: alt.label, swatch: alt.swatch, value: alt.value, confidence: 'chosen', kind: s.kind, altId };
  }
  return { id: s.id, label: s.label, swatch: s.swatch, value: s.value, confidence: s.confidence, kind: s.kind };
}

const rowHasPlan = (row: Row) => row.first.fixSafety !== 'none';
const rowIsSafe = (row: Row) => row.first.fixSafety === 'safe' && !state.chosen.has(row.key);
const rowLayerCount = (row: Row) => row.issues.filter((i) => i.status === 'open').length;

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

let bodyEl: HTMLElement | null = null;
let toastsEl: HTMLElement | null = null;

function render() {
  const scrollTop = bodyEl?.scrollTop ?? 0;
  const focusedKey = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.row')?.dataset.key;
  clear(app);
  app.append(renderHeader(), renderTabs());
  if (state.selectionChangedSinceScan && state.phase === 'results') app.appendChild(renderSelectionNotice());
  bodyEl = el('div', { class: 'body' });
  app.appendChild(bodyEl);
  if (state.phase === 'scanning' || state.phase === 'boot') bodyEl.appendChild(renderScanning());
  else bodyEl.appendChild(renderTabBody());
  app.appendChild(renderFooter());
  if (state.menu === 'settings') app.appendChild(renderSettings());
  if (state.menu === 'export') app.appendChild(renderExportMenu());
  if (state.confirm) app.appendChild(renderConfirm(state.confirm));
  toastsEl = el('div', { class: 'toasts', 'aria-live': 'polite' });
  app.appendChild(toastsEl);
  for (const toast of state.toasts) toastsEl.appendChild(renderToast(toast));
  app.appendChild(renderResizeHandle());
  bodyEl.scrollTop = scrollTop;
  if (focusedKey) bodyEl.querySelector<HTMLElement>(`.row[data-key="${CSS.escape(focusedKey)}"]`)?.focus({ preventScroll: true });
  const tabs = app.querySelector<HTMLElement>('.tabs');
  if (tabs) {
    tabs.classList.toggle('has-overflow', tabs.scrollWidth > tabs.clientWidth + 1);
    tabs.querySelector<HTMLElement>('.tab[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
}

function scoreLevel(score: number): 'high' | 'mid' | 'low' {
  return score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
}

function currentScore(): number {
  return computeScore([...state.issues.values()], state.result?.stats.nodesScanned ?? 0).total;
}

function renderHeader(): HTMLElement {
  const score = state.phase === 'results' ? currentScore() : null;
  const scoreEl = el('span', { class: 'score num', 'data-level': score !== null ? scoreLevel(score) : 'none', title: t('scoreHint') }, score !== null ? String(state.lastScore) : '–');
  if (score !== null && state.lastScore !== score) {
    animateNumber(state.lastScore, score, 300, (v) => (scoreEl.textContent = String(v)));
    state.lastScore = score;
  }
  const sev = countBySeverity([...state.issues.values()]);
  const sub =
    state.phase === 'results' && state.result
      ? el('span', { class: 'sub num', title: t('scanLayers', { n: state.result.stats.nodesScanned }) }, t('counts', { e: sev.error, w: sev.warning, i: sev.info }))
      : null;
  return el(
    'header',
    { class: 'header' },
    el('div', { class: 'title-wrap' }, el('h1', { class: 'title' }, t('appName')), score !== null ? el('span', { class: 'score-wrap', title: t('health') }, scoreEl) : null, sub),
    el('button', { class: 'icon-btn', title: t('export'), 'aria-label': t('export'), disabled: state.phase !== 'results', onclick: () => toggleMenu('export') }, svgIcon('export')),
    el('button', { class: 'icon-btn', title: t('reload'), 'aria-label': t('reload'), disabled: state.phase === 'scanning', onclick: () => startScan() }, svgIcon('refresh')),
  );
}

function tabCount(tab: Tab): number {
  if (state.phase !== 'results') {
    const f = state.progress?.found ?? {};
    switch (tab) {
      case 'colors':
        return (f.colors ?? 0) + (state.settings.showContrast ? 0 : 0);
      case 'dimensions':
        return (f.spacing ?? 0) + (f.radius ?? 0);
      case 'typography':
        return f.typography ?? 0;
      case 'components':
        return f.components ?? 0;
      case 'craft':
        return f.craft ?? 0;
      case 'a11y':
        return f.a11y ?? 0;
      case 'handoff':
        return f.handoff ?? 0;
    }
  }
  return openRowsOf(tab).length;
}

function renderTabs(): HTMLElement {
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  TABS.forEach((tab, idx) => {
    if (idx === BASE_TABS) tabs.appendChild(el('span', { class: 'tab-sep', 'aria-hidden': 'true' }));
    const count = tabCount(tab);
    tabs.appendChild(
      el(
        'button',
        {
          class: `tab${count === 0 ? ' is-empty' : ''}`,
          role: 'tab',
          'aria-selected': String(state.tab === tab),
          onclick: () => {
            state.tab = tab;
            state.selected.clear();
            state.expanded = null;
            state.dropdown = null;
            render();
          },
        },
        t(`tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`),
        el('span', { class: 'count num' }, String(count)),
      ),
    );
  });
  const right = el(
    'div',
    { class: 'tabs-right' },
    el(
      'button',
      {
        class: 'icon-btn toggle',
        'aria-pressed': String(state.settings.showContrast),
        title: t('contrastToggle'),
        'aria-label': t('contrastToggle'),
        onclick: () => {
          state.settings.showContrast = !state.settings.showContrast;
          persistSettings();
          refreshRows();
          render();
        },
      },
      svgIcon('contrast'),
    ),
    el('button', { class: 'icon-btn', title: t('settings'), 'aria-label': t('settings'), 'aria-expanded': String(state.menu === 'settings'), onclick: () => toggleMenu('settings') }, svgIcon('sliders')),
  );
  return el('div', { class: 'tabbar' }, tabs, right);
}

function renderSelectionNotice(): HTMLElement {
  return el(
    'div',
    { class: 'notice' },
    svgIcon('info'),
    el('span', { class: 'grow' }, el('b', {}, t('selectionChanged')), ' ', state.selectionCount ? t('selectionChangedBody', { n: state.selectionCount }) : ''),
    el('button', { class: 'btn btn-sm btn-secondary', onclick: () => startScan() }, svgIcon('refresh'), t('reload')),
  );
}

function phaseLabel(p: ScanProgress): string {
  switch (p.phase) {
    case 'indexing':
      return p.detail && p.detail !== 'local' ? t('phaseIndexingLib', { name: p.detail }) : t('phaseIndexing');
    case 'collecting':
      return t('phaseCollecting');
    case 'scanning':
      return t('phaseScanning', { scanned: p.scanned, total: p.total });
    case 'finalizing':
      return t('phaseFinalizing');
  }
}

function renderScanning(): HTMLElement {
  const p = state.progress ?? { phase: 'indexing', scanned: 0, total: 0, found: {} };
  const pct = p.phase === 'scanning' && p.total ? (p.scanned / p.total) * 100 : p.phase === 'finalizing' ? 100 : 0;
  const skeleton = el('div', { class: 'skeleton' });
  for (let i = 0; i < 6; i++) skeleton.appendChild(el('div', { class: 'sk-row' }, el('span', { class: 'sk-cell' }), el('span', { class: 'sk-arrow' }), el('span', { class: 'sk-cell' })));
  return el(
    'div',
    { class: 'scanning' },
    el('div', { class: 'scan-head' }, el('span', { class: 'scan-title' }, t('scanning')), el('span', { class: 'scan-phase' }, phaseLabel(p as ScanProgress))),
    el('div', { class: `bar${p.phase === 'indexing' || p.phase === 'collecting' ? ' indeterminate' : ''}` }, el('i', { style: `width:${pct}%` })),
    skeleton,
  );
}

function renderTabBody(): HTMLElement {
  const wrap = el('div', { class: 'tab-body', role: 'tabpanel' });
  if (state.notice?.kind === 'cancelled') wrap.appendChild(el('div', { class: 'notice soft' }, svgIcon('info'), el('span', {}, `${t('cancelled')} — ${t('cancelledBody')}`)));
  if (state.notice?.kind === 'error') wrap.appendChild(el('div', { class: 'notice warn' }, svgIcon('alert'), el('span', {}, `${t('errorTitle')} — ${t('errorBody', { message: state.notice.message })}`)));
  for (const w of state.result?.stats.warnings ?? []) {
    let text = '';
    if (w === 'library-cap') text = t('warnLibraryCap');
    else if (w === 'libraries-unavailable') text = t('warnLibrariesUnavailable');
    else if (w.startsWith('library:')) text = t('warnLibrary', { name: w.slice(8) });
    else if (w.startsWith('rule:')) text = t('warnRule', { rule: state.i18n.ruleTitle(w.slice(5)) });
    if (text) wrap.appendChild(el('div', { class: 'notice warn' }, svgIcon('alert'), el('span', {}, text)));
  }
  const tokens = state.result?.stats.tokens;
  if (tokens && tokens.colorVariables + tokens.floatVariables + tokens.textStyles + tokens.paintStyles === 0 && (state.tab === 'colors' || state.tab === 'dimensions' || state.tab === 'typography')) {
    wrap.appendChild(el('div', { class: 'notice soft' }, svgIcon('info'), el('span', {}, t('noTokens'))));
  }
  if (state.tab === 'a11y') {
    const contrastCount = state.rows.filter((r) => r.tab === 'colors' && r.status === 'open' && (r.prop === 'propContrast' || r.prop === 'propContrastNA')).length;
    if (state.settings.showContrast && contrastCount) wrap.appendChild(el('div', { class: 'notice soft' }, svgIcon('contrast'), el('span', {}, t('contrastInColors', { n: contrastCount }))));
    if (!state.settings.showContrast) wrap.appendChild(el('div', { class: 'notice soft' }, svgIcon('contrast'), el('span', {}, t('contrastHidden'))));
  }

  const rows = rowsOf(state.tab);
  const totalOpen = state.rows.filter((r) => r.status === 'open').length;
  if (!rows.length) {
    const allClear = totalOpen === 0 && state.rows.every((r) => r.status !== 'fixed');
    const resolved = state.rows.some((r) => r.tab === state.tab);
    wrap.appendChild(
      el(
        'div',
        { class: 'state-box' },
        el('div', { class: 'big-icon' }, svgIcon('check', 18)),
        el('h2', {}, allClear && !resolved ? t('allClearTitle') : t('tabCompleteTitle')),
        el('p', {}, resolved ? t('tabResolvedBody') : allClear ? t('allClearBody', { scope: state.result?.stats.scopeLabel ?? '', preset: state.i18n.preset(state.settings.preset).name }) : t(`tabComplete${cap(state.tab)}`)),
      ),
    );
  } else {
    let currentSection = '';
    for (const row of rows) {
      const sectionKey = `${row.kind}|${row.prop}`;
      if (sectionKey !== currentSection) {
        currentSection = sectionKey;
        wrap.appendChild(renderSectionHead(row, rows.filter((r) => `${r.kind}|${r.prop}` === sectionKey)));
      }
      wrap.appendChild(renderRow(row));
      if (state.expanded === row.key) wrap.appendChild(renderRowDetail(row));
    }
  }
  const ignoredCount = state.rows.filter((r) => r.tab === state.tab && r.status === 'ignored').length;
  if (ignoredCount) {
    wrap.appendChild(
      el(
        'button',
        {
          class: 'link-btn',
          onclick: () => {
            state.showIgnored = !state.showIgnored;
            render();
          },
        },
        svgIcon(state.showIgnored ? 'eye-off' : 'eye'),
        `${ignoredCount} ${t('statusIgnored').toLowerCase()} · ${state.showIgnored ? t('cancel') : t('all')}`,
      ),
    );
  }
  return wrap;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function kindLabel(kind: Kind): string {
  return t(`kind${cap(kind)}`);
}

function renderSectionHead(row: Row, sectionRows: Row[]): HTMLElement {
  const applicable = sectionRows.filter((r) => r.status === 'open' && rowHasPlan(r));
  const allSelected = applicable.length > 0 && applicable.every((r) => state.selected.has(r.key));
  return el(
    'button',
    {
      class: 'section-head',
      'aria-pressed': String(allSelected),
      title: applicable.length ? t('applyTo', { n: applicable.length }) : '',
      onclick: () => {
        if (!applicable.length) return;
        if (allSelected) for (const r of applicable) state.selected.delete(r.key);
        else for (const r of applicable) state.selected.add(r.key);
        render();
      },
    },
    svgIcon(KIND_ICON[row.kind]),
    el('span', { class: 'sec-kind' }, kindLabel(row.kind)),
    el('span', { class: 'sec-sep' }, '›'),
    el('span', { class: 'sec-prop' }, t(row.prop)),
    el('span', { class: 'sec-count num' }, String(sectionRows.filter((r) => r.status === 'open').length)),
  );
}

function swatchEl(hex: string | undefined): HTMLElement | null {
  if (!hex) return null;
  return el('span', { class: 'swatch' }, el('i', { style: `background:${hex}` }));
}

function badgeFor(row: Row, sug: ReturnType<typeof effectiveSuggestion>): HTMLElement | null {
  if (row.status === 'fixed') return el('span', { class: 'badge badge-fixed' }, t('badgeFixed'));
  if (row.status === 'ignored') return el('span', { class: 'badge badge-muted' }, t('badgeIgnored'));
  if (!sug) return rowHasPlan(row) ? null : el('span', { class: 'badge badge-muted' }, t('badgeManual'));
  if (!rowHasPlan(row)) return el('span', { class: 'badge badge-muted' }, t('badgeManual'));
  switch (sug.confidence) {
    case 'exact':
      return el('span', { class: 'badge badge-match' }, t('badgeMatch'));
    case 'chosen':
      return el('span', { class: 'badge badge-chosen' }, t('badgeChosen'));
    case 'close':
      return el('span', { class: 'badge badge-close' }, t('badgeClose'));
    case 'ambiguous':
      return el('span', { class: 'badge badge-close' }, t('badgeAmbiguous'));
    default:
      return el('span', { class: 'badge badge-muted' }, t('badgeManual'));
  }
}

function renderRow(row: Row): HTMLElement {
  const first = row.first;
  const sug = effectiveSuggestion(row);
  const count = rowLayerCount(row) || row.issues.length;
  const selected = state.selected.has(row.key);
  const pending = row.issues.some((i) => state.pendingFixIds.has(i.id));
  const rowEl = el('div', {
    class: `row is-${row.status}${pending ? ' is-pending' : ''}${state.justFixed.has(row.key) ? ' just-fixed' : ''}${state.expanded === row.key ? ' is-expanded' : ''}`,
    role: 'option',
    tabindex: '0',
    'data-key': row.key,
    'aria-selected': String(selected),
    onclick: (e) => onRowClick(row, e as MouseEvent),
    onkeydown: (e) => onRowKey(row, e as KeyboardEvent),
  });

  const current = el(
    'div',
    { class: 'cell cur' },
    el('span', { class: 'sev-dot', 'data-sev': row.severity, title: state.i18n.severity(row.severity) }),
    swatchEl(first.swatch) ?? el('span', { class: 'cell-icon' }, svgIcon(KIND_ICON[row.kind], 12)),
    el('span', { class: 'val', title: first.swatch ? first.currentValue : `${first.nodeName} — ${first.currentValue}` }, first.swatch ? first.currentValue.replace(/^#/, '') : row.kind === 'componentSet' || row.kind === 'component' || row.prop === 'propName' || row.prop === 'propDetached' ? first.nodeName : first.currentValue),
    state.settings.showRowCounts && count > 1 ? el('span', { class: 'cnt num', title: t('rowItems', { n: count }) }, String(count)) : null,
  );

  const hasAlternatives = Boolean(first.suggestion?.alternatives?.length);
  const suggestionCell = sug
    ? el(
        'button',
        {
          class: `cell sug${hasAlternatives ? ' has-menu' : ''}${state.dropdown === row.key ? ' is-open' : ''}`,
          title: hasAlternatives ? t('chooseSuggestion') : sug.label,
          'aria-haspopup': hasAlternatives ? 'listbox' : null,
          'aria-expanded': hasAlternatives ? String(state.dropdown === row.key) : null,
          disabled: row.status !== 'open',
          onclick: (e) => {
            e.stopPropagation();
            if (!hasAlternatives) {
              onRowClick(row, e as MouseEvent);
              return;
            }
            state.dropdown = state.dropdown === row.key ? null : row.key;
            render();
          },
        },
        swatchEl(sug.swatch) ?? (sug.kind === 'style' ? el('span', { class: 'cell-icon' }, svgIcon('style', 12)) : sug.kind === 'variable' ? el('span', { class: 'cell-icon' }, svgIcon('variable', 12)) : null),
        sug.kind === 'variable' && sug.swatch ? el('span', { class: 'cell-icon' }, svgIcon('variable', 11)) : null,
        el('span', { class: 'name' }, sug.label),
        badgeFor(row, sug),
        hasAlternatives ? el('span', { class: 'chev' }, svgIcon('chevron', 12)) : null,
      )
    : el('div', { class: 'cell sug is-empty' }, el('span', { class: 'name muted' }, rowHasPlan(row) ? '' : t(first.ruleId.startsWith('colors/') || first.ruleId.startsWith('spacing/') || first.ruleId.startsWith('radius/') || first.ruleId === 'typography/no-text-style' ? 'badgeNone' : 'badgeManual')), badgeFor(row, null));

  const info = el(
    'button',
    { class: 'row-info', title: t('details'), 'aria-label': t('details'), 'aria-expanded': String(state.expanded === row.key), onclick: (e) => (e.stopPropagation(), toggleExpanded(row.key)) },
    svgIcon('info', 13),
  );

  rowEl.append(current, el('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'), suggestionCell, info);
  if (state.dropdown === row.key && first.suggestion?.alternatives?.length) rowEl.appendChild(renderDropdown(row));
  return rowEl;
}

function renderDropdown(row: Row): HTMLElement {
  const s = row.first.suggestion!;
  const chosen = state.chosen.get(row.key);
  const option = (id: string | undefined, label: string, swatch: string | undefined, value: string | undefined, confidence: string) =>
    el(
      'button',
      {
        class: 'dd-item',
        role: 'option',
        'aria-selected': String((chosen ?? undefined) === id),
        onclick: (e) => {
          e.stopPropagation();
          if (id) state.chosen.set(row.key, id);
          else state.chosen.delete(row.key);
          state.selected.add(row.key);
          state.dropdown = null;
          render();
        },
      },
      swatchEl(swatch) ?? el('span', { class: 'cell-icon' }, svgIcon(s.kind === 'style' ? 'style' : 'variable', 12)),
      el('span', { class: 'dd-label' }, label),
      value ? el('span', { class: 'dd-sub' }, value) : null,
      confidence === 'exact' ? el('span', { class: 'badge badge-match' }, t('badgeMatch')) : null,
      (chosen ?? undefined) === id ? svgIcon('check', 12) : null,
    );
  const menu = el('div', { class: 'dropdown', role: 'listbox', onclick: (e) => e.stopPropagation() });
  menu.appendChild(option(undefined, s.label, s.swatch, s.value, s.confidence));
  for (const a of s.alternatives ?? []) menu.appendChild(option(a.id, a.label, a.swatch, a.value, 'alt'));
  return menu;
}

function renderRowDetail(row: Row): HTMLElement {
  const first = row.first;
  const i18n = state.i18n;
  const layers = row.issues.slice(0, 6);
  return el(
    'div',
    { class: 'row-detail' },
    el('div', { class: 'detail-title' }, i18n.ruleTitle(first.ruleId), el('span', { class: 'badge badge-muted mono' }, first.ruleId)),
    el('p', { class: 'detail-msg' }, i18n.ruleMessage(first)),
    el('div', { class: 'detail-grid' }, el('div', {}, el('div', { class: 'k' }, t('why')), el('div', { class: 'v' }, i18n.ruleWhy(first))), el('div', {}, el('div', { class: 'k' }, t('whatToDo')), el('div', { class: 'v' }, i18n.ruleSuggestion(first)))),
    el(
      'div',
      {},
      el('div', { class: 'k' }, t('layersList')),
      el(
        'div',
        { class: 'layer-list' },
        ...layers.map((i) =>
          el(
            'button',
            { class: 'layer-chip', title: [...i.nodePath, i.nodeName].join(' › '), onclick: (e) => (e.stopPropagation(), send({ type: 'select-node', nodeId: i.nodeId, pageId: i.pageId })) },
            svgIcon(KIND_ICON[kindOf(i.nodeType)], 11),
            el('span', {}, i.nodeName),
            i.status !== 'open' ? el('span', { class: 'badge badge-muted' }, i.status === 'fixed' ? t('badgeFixed') : t('badgeIgnored')) : null,
          ),
        ),
        row.issues.length > layers.length ? el('span', { class: 'muted' }, t('andMore', { n: row.issues.length - layers.length })) : null,
      ),
    ),
    el(
      'div',
      { class: 'detail-actions' },
      el('button', { class: 'btn btn-sm btn-secondary', onclick: (e) => (e.stopPropagation(), viewRow(row)) }, svgIcon('target'), t('viewLayers')),
      row.status === 'open'
        ? el('button', { class: 'btn btn-sm btn-secondary', onclick: (e) => (e.stopPropagation(), setRowIgnored(row, true)) }, svgIcon('eye-off'), t('ignoreIssue'))
        : row.status === 'ignored'
          ? el('button', { class: 'btn btn-sm btn-secondary', onclick: (e) => (e.stopPropagation(), setRowIgnored(row, false)) }, svgIcon('eye'), t('unignore'))
          : null,
      RULE_BY_ID[first.ruleId]?.docUrl ? el('button', { class: 'btn btn-sm btn-secondary', onclick: () => send({ type: 'open-url', url: RULE_BY_ID[first.ruleId].docUrl! }) }, svgIcon('external'), t('openDoc')) : null,
    ),
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function applicableRows(): { rows: Row[]; mode: 'selected' | 'safe' } {
  const tabRows = openRowsOf(state.tab);
  const selected = tabRows.filter((r) => state.selected.has(r.key) && rowHasPlan(r));
  if (selected.length) return { rows: selected, mode: 'selected' };
  return { rows: tabRows.filter((r) => rowIsSafe(r)), mode: 'safe' };
}

function renderFooter(): HTMLElement {
  const footer = el('footer', { class: 'footer' });
  if (state.phase === 'scanning' || state.phase === 'boot') {
    const p = state.progress;
    void p;
    footer.append(el('span', { class: 'foot-text' }, t('scanning')), el('button', { class: 'btn btn-secondary', onclick: () => send({ type: 'cancel-scan' }) }, t('stop')));
    return footer;
  }
  if (state.fixing) {
    footer.append(el('span', { class: 'foot-text num' }, t('fixing', { done: state.fixing.done, total: state.fixing.total })), el('div', { class: 'bar foot-bar' }, el('i', { style: `width:${(state.fixing.done / Math.max(1, state.fixing.total)) * 100}%` })));
    return footer;
  }
  const { rows, mode } = applicableRows();
  const layers = rows.reduce((n, r) => n + rowLayerCount(r), 0);
  let text: string;
  const layersLabel = layers === 1 ? t('rowItemOne') : t('rowItems', { n: layers });
  if (!rows.length) {
    const hasReview = openRowsOf(state.tab).some((r) => rowHasPlan(r));
    text = hasReview ? t('footerManualHint') : t('footerNothing');
  } else if (mode === 'selected') {
    text = `${rows.length === 1 ? t('rowsSelectedOne') : t('rowsSelected', { n: rows.length })} · ${layersLabel}`;
  } else {
    const unitKey = state.tab === 'colors' ? 'unitColor' : state.tab === 'dimensions' ? 'unitDimension' : state.tab === 'typography' ? 'unitText' : 'unitSuggestion';
    const unit = rows.length === 1 ? t(`${unitKey}One`) : t(`${unitKey}Many`);
    text = t('footerUpdateTpl', { n: rows.length, unit, layers: layersLabel });
  }
  footer.append(
    el('span', { class: 'foot-text num' }, text),
    el('button', { class: 'btn btn-primary', disabled: !rows.length, onclick: () => applyRows(rows) }, t('applyBtn'), el('span', { class: 'count-pill num' }, String(rows.length))),
  );
  return footer;
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

function toggleExpanded(key: string) {
  state.expanded = state.expanded === key ? null : key;
  state.dropdown = null;
  render();
}

function onRowClick(row: Row, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.row-info, .dropdown')) return;
  const tabRows = rowsOf(state.tab);
  if (e.shiftKey && state.anchorKey) {
    const a = tabRows.findIndex((r) => r.key === state.anchorKey);
    const b = tabRows.findIndex((r) => r.key === row.key);
    if (a >= 0 && b >= 0) {
      const [from, to] = a < b ? [a, b] : [b, a];
      for (let i = from; i <= to; i++) if (tabRows[i].status === 'open') state.selected.add(tabRows[i].key);
    }
  } else if (e.metaKey || e.ctrlKey) {
    if (state.selected.has(row.key)) state.selected.delete(row.key);
    else if (row.status === 'open') state.selected.add(row.key);
    state.anchorKey = row.key;
  } else {
    const only = state.selected.size === 1 && state.selected.has(row.key);
    state.selected.clear();
    if (!only && row.status === 'open') state.selected.add(row.key);
    state.anchorKey = row.key;
    viewRow(row);
  }
  state.dropdown = null;
  render();
}

function onRowKey(row: Row, e: KeyboardEvent) {
  const rowsEls = [...app.querySelectorAll<HTMLElement>('.row')];
  const idx = rowsEls.findIndex((r) => r.dataset.key === row.key);
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      rowsEls[Math.min(rowsEls.length - 1, idx + 1)]?.focus();
      break;
    case 'ArrowUp':
      e.preventDefault();
      rowsEls[Math.max(0, idx - 1)]?.focus();
      break;
    case ' ':
      e.preventDefault();
      if (state.selected.has(row.key)) state.selected.delete(row.key);
      else if (row.status === 'open') state.selected.add(row.key);
      state.anchorKey = row.key;
      render();
      break;
    case 'Enter':
      e.preventDefault();
      if (row.status === 'open' && rowHasPlan(row)) applyRows([row]);
      break;
    case 'i':
    case 'I':
      e.preventDefault();
      toggleExpanded(row.key);
      break;
    case 'v':
    case 'V':
      e.preventDefault();
      viewRow(row);
      break;
  }
}

function viewRow(row: Row) {
  const ids = row.issues.map((i) => i.nodeId);
  send({ type: 'select-nodes', nodeIds: ids, pageId: row.first.pageId });
}

function applyRows(rows: Row[]) {
  const items: { issueId: string; alternativeId?: string }[] = [];
  for (const row of rows) {
    const altId = state.chosen.get(row.key);
    for (const issue of row.issues) {
      if (issue.status !== 'open' || state.pendingFixIds.has(issue.id)) continue;
      items.push({ issueId: issue.id, alternativeId: altId });
      state.pendingFixIds.add(issue.id);
    }
  }
  if (!items.length) return;
  if (items.length > 3) state.fixing = { done: 0, total: items.length };
  render();
  send({ type: 'fix-many', items });
}

function setRowIgnored(row: Row, ignored: boolean) {
  for (const issue of row.issues) {
    if (ignored ? issue.status !== 'open' : issue.status !== 'ignored') continue;
    issue.status = ignored ? 'ignored' : 'open';
    send({ type: 'ignore-issue', issueId: issue.id, ignored });
  }
  state.selected.delete(row.key);
  refreshRows();
  render();
  toast({ message: ignored ? t('toastIgnored') : t('toastUnignored'), actionLabel: t('undo'), timeout: 6000, onAction: () => setRowIgnored(row, !ignored) });
}

function refreshRows() {
  state.rows = buildRows();
  for (const key of [...state.selected]) if (!state.rows.some((r) => r.key === key && r.status === 'open')) state.selected.delete(key);
}

function onFixDone(batchId: string, outcomes: { issueId: string; ok: boolean; reason?: string }[], undoable: boolean) {
  const before = state.lastScore;
  const fixed: Issue[] = [];
  const failed: { issueId: string; reason?: string }[] = [];
  for (const o of outcomes) {
    state.pendingFixIds.delete(o.issueId);
    const issue = state.issues.get(o.issueId);
    if (!issue) continue;
    if (o.ok) {
      issue.status = 'fixed';
      fixed.push(issue);
    } else failed.push(o);
  }
  state.fixing = null;
  refreshRows();
  state.justFixed = new Set(state.rows.filter((r) => r.issues.some((i) => fixed.includes(i))).map((r) => r.key));
  for (const key of state.justFixed) state.chosen.delete(key);
  render();
  setTimeout(() => state.justFixed.clear(), 400);
  const after = currentScore();
  if (fixed.length) {
    const label = fixed[0].suggestion?.label ?? state.i18n.ruleTitle(fixed[0].ruleId);
    toast({
      message: fixed.length === 1 ? t('toastFixedOne', { label }) : t('toastFixed', { n: fixed.length, before, after }),
      actionLabel: undoable ? t('undo') : undefined,
      onAction: undoable ? () => send({ type: 'undo', batchId }) : undefined,
      timeout: 10000,
    });
  }
  if (failed.length) {
    const reason = state.i18n.fixReason(failed[0].reason);
    toast({ message: failed.length === 1 ? reason : `${t('toastFixFailed', { n: failed.length })} — ${reason}`, timeout: 6000, error: true });
  }
}

function onUndoDone(issueIds: string[]) {
  for (const id of issueIds) {
    const issue = state.issues.get(id);
    if (issue) issue.status = 'open';
  }
  refreshRows();
  render();
  toast({ message: issueIds.length === 1 ? t('toastUndoneOne') : t('toastUndone', { n: issueIds.length }), timeout: 4000 });
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

function resolveScope(): ScanScope {
  if (state.settings.scope === 'file') return 'file';
  if (state.settings.scope === 'page') return 'page';
  return state.selectionCount > 0 ? 'selection' : 'page';
}

function startScan(force = false) {
  if (state.phase === 'scanning') return;
  const scope = resolveScope();
  if (scope === 'file' && !force) {
    state.confirm = {
      title: t('fileWarningTitle'),
      body: t('fileWarningBody', { pages: state.pageCount }),
      confirmLabel: t('confirm'),
      onConfirm: () => startScan(true),
    };
    render();
    return;
  }
  const s = state.settings;
  state.confirm = null;
  state.menu = null;
  state.dropdown = null;
  state.expanded = null;
  state.selected.clear();
  state.chosen.clear();
  state.progress = { phase: 'indexing', scanned: 0, total: 0, found: {} };
  state.phase = 'scanning';
  state.notice = null;
  state.selectionChangedSinceScan = false;
  state.scannedSelection = scope === 'selection';
  send({ type: 'scan', scope, preset: s.preset, options: s.options, disabledRules: s.disabledRules, enabledRules: s.enabledRules });
  render();
}

function receiveResult(result: ScanResult, notice: typeof state.notice) {
  state.result = result;
  state.issues = new Map(result.issues.map((i) => [i.id, { ...i }]));
  state.notice = notice;
  state.fixing = null;
  state.pendingFixIds.clear();
  state.phase = 'results';
  refreshRows();
  // Ouvre le premier onglet avec des suggestions (comme Check designs).
  const firstWithRows = TABS.find((tab) => openRowsOf(tab).length > 0);
  state.tab = firstWithRows ?? 'colors';
  state.lastScore = 0;
  render();
}

function scheduleRescan() {
  clearTimeout(state.rescanTimer);
  state.rescanTimer = window.setTimeout(() => startScan(), 350);
}

// ---------------------------------------------------------------------------
// Réglages (popover)
// ---------------------------------------------------------------------------

function persistSettings() {
  send({ type: 'save-settings', settings: state.settings });
}

function toggleMenu(kind: 'settings' | 'export') {
  state.menu = state.menu === kind ? null : kind;
  state.dropdown = null;
  render();
}

function segmented<T extends string>(options: { value: T; label: string; title?: string }[], current: T, onChange: (v: T) => void): HTMLElement {
  return el(
    'div',
    { class: 'segmented', role: 'radiogroup' },
    ...options.map((o) => el('button', { role: 'radio', 'aria-checked': String(o.value === current), 'aria-pressed': String(o.value === current), title: o.title ?? null, onclick: () => onChange(o.value) }, o.label)),
  );
}

function checkbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  return el('label', { class: 'check' }, el('input', { type: 'checkbox', checked, onchange: (e) => onChange((e.target as HTMLInputElement).checked) }), el('span', {}, label));
}

function numberField(label: string, value: number, min: number, max: number, onChange: (v: number) => void): HTMLElement {
  return el(
    'div',
    { class: 'field' },
    el('span', {}, label),
    el('input', {
      type: 'number',
      min,
      max,
      value,
      onchange: (e) => {
        const v = Number((e.target as HTMLInputElement).value);
        if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
      },
    }),
  );
}

function renderSettings(): HTMLElement {
  const s = state.settings;
  const o = s.options;
  const update = (fn: () => void, rescan = true) => {
    fn();
    persistSettings();
    render();
    if (rescan) scheduleRescan();
  };
  const active = resolveActiveRules(s.preset, s.disabledRules, s.enabledRules);
  const rulesList = el(
    'div',
    { class: 'rule-list' },
    ...RULES.map((r) =>
      checkbox(`${state.i18n.ruleTitle(r.id)}`, active.has(r.id), (on) =>
        update(() => {
          const inPreset = resolveActiveRules(s.preset, [], []).has(r.id);
          s.disabledRules = s.disabledRules.filter((x) => x !== r.id);
          s.enabledRules = s.enabledRules.filter((x) => x !== r.id);
          if (inPreset && !on) s.disabledRules.push(r.id);
          if (!inPreset && on) s.enabledRules.push(r.id);
        }),
      ),
    ),
  );
  const panel = el(
    'div',
    { class: 'popover settings', role: 'dialog', 'aria-label': t('settings'), onclick: (e) => e.stopPropagation() },
    el('div', { class: 'pop-section' }, el('div', { class: 'k' }, t('setScope')), segmented(
      [
        { value: 'auto', label: t('scopeAuto'), title: t('scopeAutoHint') },
        { value: 'page', label: t('scopePage') },
        { value: 'file', label: t('scopeFile') },
      ],
      s.scope,
      (v) => update(() => (s.scope = v)),
    )),
    el(
      'div',
      { class: 'pop-section' },
      el('div', { class: 'k' }, t('setPreset')),
      el(
        'div',
        { class: 'select' },
        el(
          'select',
          { onchange: (e) => update(() => ((s.preset = (e.target as HTMLSelectElement).value as Settings['preset']), (s.disabledRules = []), (s.enabledRules = []))) },
          ...PRESET_IDS.map((id) => el('option', { value: id, selected: s.preset === id }, `${state.i18n.preset(id).name} — ${state.i18n.preset(id).hint}`)),
        ),
      ),
    ),
    el('div', { class: 'pop-section' }, el('div', { class: 'k' }, t('setContrast')), segmented(
      [
        { value: 'AA', label: 'AA' },
        { value: 'AAA', label: 'AAA' },
      ],
      o.contrastLevel,
      (v) => update(() => (o.contrastLevel = v)),
    )),
    el(
      'div',
      { class: 'pop-section stack' },
      checkbox(t('setRowCounts'), s.showRowCounts, (v) => update(() => (s.showRowCounts = v), false)),
      checkbox(t('optIncludeLibraries'), o.includeLibraries, (v) => update(() => (o.includeLibraries = v))),
    ),
    el(
      'details',
      { class: 'accordion' },
      el('summary', {}, t('setOptions')),
      el(
        'div',
        { class: 'body stack' },
        checkbox(t('optIgnoreHidden'), o.ignoreHidden, (v) => update(() => (o.ignoreHidden = v))),
        checkbox(t('optIgnoreLocked'), o.ignoreLocked, (v) => update(() => (o.ignoreLocked = v))),
        checkbox(t('optInsideInstances'), o.scanInsideInstances, (v) => update(() => (o.scanInsideInstances = v))),
        el('div', { class: 'field' }, el('span', {}, t('optBaseGrid')), segmented(
          [
            { value: '4', label: '4 px' },
            { value: '8', label: '8 px' },
          ],
          String(o.baseGrid),
          (v) => update(() => (o.baseGrid = Number(v) as 4 | 8)),
        )),
        numberField(t('optTolerance'), o.spacingTolerance, 0, 12, (v) => update(() => (o.spacingTolerance = v))),
        numberField(t('optTouch'), o.minTouchTarget, 16, 64, (v) => update(() => (o.minTouchTarget = v))),
        numberField(t('optMinFont'), o.minFontSize, 8, 16, (v) => update(() => (o.minFontSize = v))),
      ),
    ),
    el('details', { class: 'accordion' }, el('summary', {}, `${t('setRules')} · ${active.size}/${ALL_RULE_IDS.length}`), el('div', { class: 'body' }, rulesList)),
    el('div', { class: 'pop-section' }, el('div', { class: 'k' }, t('setLanguage')), segmented(
      [
        { value: 'fr', label: 'Français' },
        { value: 'en', label: 'English' },
      ],
      s.locale,
      (v) =>
        update(() => {
          s.locale = v;
          state.i18n = new I18n(v);
          document.documentElement.lang = v;
        }, false),
    )),
    el('div', { class: 'pop-section about' }, el('div', { class: 'k' }, t('aboutTitle')), el('div', { class: 'hint' }, t('aboutBody')), el('div', { class: 'hint' }, `${t('appName')} ${t('version')}`)),
  );
  return el('div', { class: 'scrim', onclick: () => toggleMenu('settings') }, panel);
}

function renderExportMenu(): HTMLElement {
  const close = () => {
    state.menu = null;
    render();
  };
  const menu = el(
    'div',
    { class: 'popover menu export', role: 'menu', onclick: (e) => e.stopPropagation() },
    el('button', { role: 'menuitem', onclick: () => (close(), exportMarkdown(false)) }, svgIcon('export'), t('exportMd')),
    el('button', { role: 'menuitem', onclick: () => (close(), exportMarkdown(true)) }, svgIcon('check'), t('copyMd')),
    el('button', { role: 'menuitem', onclick: () => (close(), exportCsv()) }, svgIcon('export'), t('exportCsv')),
  );
  return el('div', { class: 'scrim transparent', onclick: close }, menu);
}

function renderConfirm(c: Confirm): HTMLElement {
  const cancel = () => {
    state.confirm = null;
    render();
  };
  const dialog = el(
    'div',
    { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': c.title, onclick: (e) => e.stopPropagation() },
    el('h2', {}, c.title),
    el('p', {}, c.body),
    el('div', { class: 'row-end' }, el('button', { class: 'btn btn-secondary', onclick: cancel }, t('cancel')), el('button', { class: 'btn btn-primary', onclick: () => c.onConfirm() }, c.confirmLabel)),
  );
  return el('div', { class: 'scrim dim', onclick: cancel }, dialog);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function reportLabels(): ReportLabels {
  const i18n = state.i18n;
  const fr = state.settings.locale === 'fr';
  return {
    title: t('appName'),
    generated: fr ? 'Généré' : 'Generated',
    scope: t('scope'),
    nodes: fr ? 'Calques analysés' : 'Layers checked',
    duration: fr ? 'Durée' : 'Duration',
    score: t('health'),
    summary: fr ? 'Résumé' : 'Summary',
    category: (c) => i18n.category(c),
    severity: (s) => i18n.severity(s),
    rule: (r) => i18n.ruleTitle(r),
    message: (i) => i18n.ruleMessage(i),
    status: (s) => (s === 'open' ? t('statusOpen') : s === 'fixed' ? t('fixed') : t('ignored')),
    columns: {
      rule: fr ? 'Règle' : 'Rule',
      severity: t('filterSeverity'),
      category: fr ? 'Catégorie' : 'Category',
      layer: fr ? 'Calque' : 'Layer',
      path: fr ? 'Chemin' : 'Path',
      current: t('current'),
      suggested: t('suggested'),
      status: t('filterStatus'),
      fix: 'Fix',
    },
    fixSafety: (f) => (f === 'safe' ? t('safeFix') : f === 'review' ? t('reviewFix') : t('noFix')),
    noIssues: t('emptyTitle'),
    occurrences: (n) => (n === 1 ? t('occurrenceOne') : t('occurrences', { n })),
  };
}

function fileStem(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `senior-check-${(state.fileName || 'design').replace(/[^\w.-]+/g, '-').toLowerCase()}-${date}`;
}

function exportMarkdown(copy: boolean) {
  if (!state.result) return;
  const issues = [...state.issues.values()];
  const md = buildMarkdownReport(issues, state.result.stats, computeScore(issues, state.result.stats.nodesScanned), reportLabels(), state.fileName, new Date());
  if (copy) copyText(md).then((ok) => toast({ message: ok ? t('copied') : t('toastFixFailed', { n: 1 }), timeout: 3000, error: !ok }));
  else {
    download(`${fileStem()}.md`, md, 'text/markdown;charset=utf-8');
    toast({ message: t('downloaded'), timeout: 3000 });
  }
}

function exportCsv() {
  download(`${fileStem()}.csv`, '﻿' + buildCsvReport([...state.issues.values()], reportLabels()), 'text/csv;charset=utf-8');
  toast({ message: t('downloaded'), timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Toasts, redimensionnement, clavier global
// ---------------------------------------------------------------------------

function toast(opts: Omit<Toast, 'id'>) {
  const item: Toast = { id: ++state.toastSeq, ...opts };
  state.toasts.push(item);
  if (state.toasts.length > 3) dismissToast(state.toasts[0].id);
  toastsEl?.appendChild(renderToast(item));
}

function dismissToast(id: number) {
  state.toasts = state.toasts.filter((x) => x.id !== id);
  const node = toastsEl?.querySelector<HTMLElement>(`[data-toast="${id}"]`);
  if (!node) return;
  node.classList.add('leaving');
  const done = () => node.remove();
  node.addEventListener('animationend', done, { once: true });
  setTimeout(done, 220);
}

function renderToast(item: Toast): HTMLElement {
  let remaining = item.timeout;
  let startedAt = performance.now();
  let timer = window.setTimeout(() => dismissToast(item.id), remaining);
  return el(
    'div',
    {
      class: `toast${item.error ? ' is-error' : ''}`,
      role: 'status',
      'data-toast': String(item.id),
      onmouseenter: () => {
        clearTimeout(timer);
        remaining -= performance.now() - startedAt;
      },
      onmouseleave: () => {
        startedAt = performance.now();
        timer = window.setTimeout(() => dismissToast(item.id), Math.max(800, remaining));
      },
    },
    el('span', { class: 'msg' }, item.message),
    item.actionLabel ? el('button', { class: 'toast-action', onclick: () => (item.onAction?.(), dismissToast(item.id)) }, item.actionLabel) : null,
    el('button', { class: 'icon-btn sm on-dark', 'aria-label': t('cancel'), onclick: () => dismissToast(item.id) }, svgIcon('close', 12)),
    el('span', { class: 'progress', style: `animation: shrink ${item.timeout}ms linear forwards` }),
  );
}

function renderResizeHandle(): HTMLElement {
  const handle = el('div', { class: 'resize-handle', title: t('resizeHandle'), 'aria-hidden': 'true' });
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = window.innerWidth;
    const startH = window.innerHeight;
    let raf = 0;
    const move = (ev: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => send({ type: 'resize', width: Math.round(startW + (ev.clientX - startX)), height: Math.round(startH + (ev.clientY - startY)) }));
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
  return handle;
}

document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  const inInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
  if (e.key === 'Escape') {
    if (state.dropdown) state.dropdown = null;
    else if (state.menu) state.menu = null;
    else if (state.confirm) state.confirm = null;
    else if (state.expanded) state.expanded = null;
    else state.selected.clear();
    render();
    return;
  }
  if (inInput) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && state.phase === 'results') {
    e.preventDefault();
    for (const r of openRowsOf(state.tab)) if (rowHasPlan(r)) state.selected.add(r.key);
    render();
  }
  if (e.key === 'r' && !e.metaKey && !e.ctrlKey && state.phase === 'results') startScan();
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !target.closest('.row') && state.phase === 'results') {
    const first = app.querySelector<HTMLElement>('.row');
    if (first) {
      e.preventDefault();
      first.focus();
    }
  }
});

// ---------------------------------------------------------------------------
// Messages du sandbox
// ---------------------------------------------------------------------------

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as PluginToUiMessage | undefined;
  if (!msg) return;
  switch (msg.type) {
    case 'init': {
      const stored = msg.settings as Partial<Settings>;
      state.settings = { ...DEFAULT_SETTINGS, ...stored, options: { ...DEFAULT_SETTINGS.options, ...(stored.options ?? {}) } };
      if (!['auto', 'page', 'file'].includes(state.settings.scope)) state.settings.scope = 'auto';
      if (!stored.locale) state.settings.locale = detectLocale();
      state.i18n = new I18n(state.settings.locale);
      document.documentElement.lang = state.settings.locale;
      state.selectionCount = msg.selectionCount;
      state.fileName = msg.fileName;
      state.pageName = msg.pageName;
      state.pageCount = msg.pageCount;
      render();
      startScan(); // comme Check designs : l'analyse démarre immédiatement
      break;
    }
    case 'selection':
      state.selectionCount = msg.count;
      if (state.phase === 'results' && (state.scannedSelection || (state.settings.scope === 'auto' && msg.count > 0))) {
        state.selectionChangedSinceScan = true;
        const existing = app.querySelector('.notice');
        if (!existing) render();
      }
      break;
    case 'page-changed':
      state.pageName = msg.pageName;
      break;
    case 'scan-progress':
      state.progress = msg.progress;
      if (state.phase === 'scanning') render();
      break;
    case 'scan-done':
      receiveResult(msg.result, null);
      break;
    case 'scan-cancelled':
      if (msg.partial) receiveResult(msg.partial, { kind: 'cancelled' });
      else {
        state.phase = 'results';
        render();
      }
      break;
    case 'scan-error':
      if (msg.partial) receiveResult(msg.partial, { kind: 'error', message: msg.message });
      else {
        state.phase = 'results';
        render();
        toast({ message: `${t('errorTitle')} — ${msg.message}`, timeout: 8000, error: true });
      }
      break;
    case 'fix-progress':
      state.fixing = { done: msg.done, total: msg.total };
      render();
      break;
    case 'fix-done':
      onFixDone(msg.batchId, msg.outcomes, msg.undoable);
      break;
    case 'undo-done':
      onUndoDone(msg.issueIds);
      break;
    case 'ignored-updated':
    case 'settings-saved':
      break;
  }
};

render();
send({ type: 'ui-ready' });

export {};
