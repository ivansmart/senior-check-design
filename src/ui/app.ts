import { ALL_RULE_IDS, PRESET_IDS, RULE_BY_ID, RULES, resolveActiveRules } from '../shared/rules-catalog';
import { buildCsvReport, buildMarkdownReport, type ReportLabels } from '../shared/report';
import { computeScore, countBySeverity } from '../shared/score';
import {
  CATEGORIES,
  DEFAULT_SETTINGS,
  type Category,
  type Issue,
  type PluginToUiMessage,
  type PresetId,
  type ScanProgress,
  type ScanResult,
  type ScanScope,
  type Settings,
  type Severity,
  type UiToPluginMessage,
} from '../shared/types';
import { animateNumber, append, clear, copyText, download, el, svgIcon } from './dom';
import { I18n, detectLocale } from './i18n';

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

type Screen = 'config' | 'scanning' | 'results';
type SeverityFilter = 'all' | 'errors' | 'errors-warnings';
type StatusFilter = 'open' | 'fixed' | 'ignored' | 'all';

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
  danger?: boolean;
}

const state = {
  screen: 'config' as Screen,
  settings: { ...DEFAULT_SETTINGS, locale: detectLocale() } as Settings,
  i18n: new I18n(detectLocale()),
  selectionCount: 0,
  fileName: '',
  pageName: '',
  pageCount: 1,
  ignoredIssueIds: new Set<string>(),
  progress: null as ScanProgress | null,
  result: null as ScanResult | null,
  issues: new Map<string, Issue>(),
  notice: null as null | { kind: 'cancelled' } | { kind: 'error'; message: string },
  filters: { categories: new Set<Category>(), severity: 'all' as SeverityFilter, status: 'open' as StatusFilter, query: '' },
  openGroups: new Set<string>(),
  closedGroups: new Set<string>(),
  detailId: null as string | null,
  toasts: [] as Toast[],
  confirm: null as Confirm | null,
  menu: null as null | 'export' | 'settings',
  fixing: null as null | { done: number; total: number },
  pendingFixIds: new Set<string>(),
  lastScore: 100,
  scanStartedAt: 0,
  toastSeq: 0,
};

const app = document.getElementById('app')!;
const send = (msg: UiToPluginMessage) => parent.postMessage({ pluginMessage: msg }, '*');
const t = (key: string, vars?: Record<string, string | number | undefined>) => state.i18n.t(key, vars);

// ---------------------------------------------------------------------------
// Rendu racine
// ---------------------------------------------------------------------------

let toastsEl: HTMLElement | null = null;

function render() {
  clear(app);
  switch (state.screen) {
    case 'config':
      app.appendChild(renderConfig());
      break;
    case 'scanning':
      app.appendChild(renderScanning());
      break;
    case 'results':
      app.appendChild(renderResults());
      break;
  }
  if (state.detailId) app.appendChild(renderDetail(state.detailId));
  if (state.confirm) app.appendChild(renderConfirm(state.confirm));
  if (state.menu) app.appendChild(renderMenu(state.menu));
  toastsEl = el('div', { class: 'toasts', 'aria-live': 'polite' });
  app.appendChild(toastsEl);
  for (const toast of state.toasts) toastsEl.appendChild(renderToast(toast));
  app.appendChild(renderResizeHandle());
}

// ---------------------------------------------------------------------------
// Écran 1 — Configuration
// ---------------------------------------------------------------------------

function scopeButtonLabel(): string {
  switch (state.settings.scope) {
    case 'selection':
      return t('analyzeSelection');
    case 'file':
      return t('analyzeFile');
    default:
      return t('analyzePage');
  }
}

function activeRuleSet(): Set<string> {
  return resolveActiveRules(state.settings.preset, state.settings.disabledRules, state.settings.enabledRules);
}

function renderConfig(): HTMLElement {
  const s = state.settings;
  const scope = s.scope === 'selection' && state.selectionCount === 0 ? 'page' : s.scope;
  if (scope !== s.scope) s.scope = scope;

  const header = el(
    'header',
    { class: 'header' },
    el('div', { class: 'title' }, t('appName'), el('span', { class: 'sub' }, t('tagline'))),
    el('button', { class: 'btn btn-icon', title: t('settings'), 'aria-label': t('settings'), onclick: () => toggleMenu('settings') }, svgIcon('settings')),
  );

  const presetGrid = el(
    'div',
    { class: 'preset-grid', role: 'radiogroup', 'aria-label': t('preset') },
    ...PRESET_IDS.map((id) =>
      el(
        'button',
        {
          class: 'preset-card',
          role: 'radio',
          'aria-checked': String(s.preset === id),
          'aria-pressed': String(s.preset === id),
          onclick: () => {
            s.preset = id;
            s.disabledRules = [];
            s.enabledRules = [];
            persistSettings();
            render();
          },
        },
        el('span', { class: 'name' }, state.i18n.preset(id).name),
        el('span', { class: 'desc' }, state.i18n.preset(id).hint),
      ),
    ),
  );

  const selectionLabel =
    state.selectionCount === 0 ? t('selectionNone') : state.selectionCount === 1 ? t('selectionOne') : t('selectionCount', { n: state.selectionCount });

  const scopeSeg = el(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': t('scope') },
    ...(['selection', 'page', 'file'] as ScanScope[]).map((sc) =>
      el(
        'button',
        {
          role: 'radio',
          'aria-checked': String(s.scope === sc),
          'aria-pressed': String(s.scope === sc),
          disabled: sc === 'selection' && state.selectionCount === 0,
          title: sc === 'selection' ? selectionLabel : sc === 'page' ? state.pageName : state.fileName,
          onclick: () => {
            s.scope = sc;
            persistSettings();
            render();
          },
        },
        sc === 'selection' ? t('scopeSelection') : sc === 'page' ? t('scopePage') : t('scopeFile'),
      ),
    ),
  );
  const scopeHint = el('div', { class: 'hint', style: 'margin-top:6px' }, s.scope === 'selection' ? selectionLabel : s.scope === 'page' ? state.pageName : `${state.fileName} · ${state.pageCount} pages`);

  const o = s.options;
  const checkbox = (key: keyof typeof o, label: string) =>
    el(
      'label',
      { class: 'check' },
      el('input', {
        type: 'checkbox',
        checked: Boolean(o[key]),
        onchange: (e) => {
          (o as unknown as Record<string, unknown>)[key] = (e.target as HTMLInputElement).checked;
          persistSettings();
        },
      }),
      el('span', {}, label),
    );
  const numberField = (key: 'spacingTolerance' | 'minTouchTarget' | 'minFontSize', label: string, min: number, max: number) =>
    el(
      'div',
      { class: 'field' },
      el('span', {}, label),
      el('input', {
        type: 'number',
        min,
        max,
        value: o[key],
        onchange: (e) => {
          const v = Number((e.target as HTMLInputElement).value);
          if (Number.isFinite(v)) o[key] = Math.min(max, Math.max(min, v));
          persistSettings();
        },
      }),
    );
  const gridField = el(
    'div',
    { class: 'field' },
    el('span', {}, t('optBaseGrid')),
    el(
      'div',
      { class: 'segmented', style: 'width:96px' },
      ...([4, 8] as const).map((g) =>
        el(
          'button',
          {
            'aria-pressed': String(o.baseGrid === g),
            onclick: () => {
              o.baseGrid = g;
              persistSettings();
              render();
            },
          },
          `${g} px`,
        ),
      ),
    ),
  );

  const options = el(
    'details',
    { class: 'accordion' },
    el('summary', {}, t('options')),
    el(
      'div',
      { class: 'body stack' },
      checkbox('ignoreHidden', t('optIgnoreHidden')),
      checkbox('ignoreLocked', t('optIgnoreLocked')),
      checkbox('scanInsideInstances', t('optInsideInstances')),
      checkbox('includeLibraries', t('optIncludeLibraries')),
      gridField,
      numberField('spacingTolerance', t('optTolerance'), 0, 12),
      numberField('minTouchTarget', t('optTouch'), 16, 64),
      numberField('minFontSize', t('optMinFont'), 8, 16),
    ),
  );

  const active = activeRuleSet();
  const rulesList = el(
    'div',
    { class: 'rule-list' },
    ...RULES.map((r) =>
      el(
        'label',
        { class: 'check' },
        el('input', {
          type: 'checkbox',
          checked: active.has(r.id),
          onchange: (e) => {
            const on = (e.target as HTMLInputElement).checked;
            toggleRule(r.id, on);
          },
        }),
        el('span', {}, state.i18n.ruleTitle(r.id)),
        el('span', { class: 'cat' }, state.i18n.category(r.category, true)),
      ),
    ),
  );
  const rules = el(
    'details',
    { class: 'accordion' },
    el('summary', {}, `${t('rulesTitle')} · ${active.size}/${ALL_RULE_IDS.length}`),
    el('div', { class: 'body stack' }, el('div', { class: 'hint' }, t('rulesHint')), rulesList),
  );

  const body = el(
    'div',
    { class: 'scroll' },
    el('section', { class: 'section' }, el('h2', { class: 'section-title' }, t('preset')), presetGrid),
    el('section', { class: 'section' }, el('h2', { class: 'section-title' }, t('scope')), scopeSeg, scopeHint),
    el('section', { class: 'section' }, options),
    el('section', { class: 'section' }, rules),
  );

  const footer = el(
    'footer',
    { class: 'footer' },
    el('button', { class: 'btn btn-primary btn-block', onclick: () => requestScan() }, svgIcon('play'), scopeButtonLabel()),
  );

  return el('div', { class: 'screen' }, header, body, footer);
}

function toggleRule(id: string, on: boolean) {
  const s = state.settings;
  const inPreset = resolveActiveRules(s.preset, [], []).has(id);
  s.disabledRules = s.disabledRules.filter((r) => r !== id);
  s.enabledRules = s.enabledRules.filter((r) => r !== id);
  if (inPreset && !on) s.disabledRules.push(id);
  if (!inPreset && on) s.enabledRules.push(id);
  persistSettings();
}

function persistSettings() {
  send({ type: 'save-settings', settings: state.settings });
}

function requestScan() {
  if (state.settings.scope === 'file') {
    state.confirm = {
      title: t('fileWarningTitle'),
      body: t('fileWarningBody', { pages: state.pageCount }),
      confirmLabel: t('confirm'),
      onConfirm: () => startScan(),
    };
    render();
    return;
  }
  startScan();
}

function startScan() {
  const s = state.settings;
  state.confirm = null;
  state.menu = null;
  state.detailId = null;
  state.progress = { phase: 'indexing', scanned: 0, total: 0, found: {} };
  state.screen = 'scanning';
  state.scanStartedAt = performance.now();
  state.notice = null;
  send({ type: 'scan', scope: s.scope, preset: s.preset, options: s.options, disabledRules: s.disabledRules, enabledRules: s.enabledRules });
  render();
}

// ---------------------------------------------------------------------------
// Écran 1b — Scan en cours
// ---------------------------------------------------------------------------

let progressRefs: { phase: HTMLElement; bar: HTMLElement; barWrap: HTMLElement; counts: Map<Category, HTMLElement> } | null = null;

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
  const p = state.progress!;
  const counts = new Map<Category, HTMLElement>();
  const grid = el('div', { class: 'found-grid' });
  for (const c of CATEGORIES) {
    const count = el('span', { class: 'count num' }, '0');
    counts.set(c, count);
    grid.append(el('span', {}, state.i18n.category(c)), count);
  }
  const bar = el('i');
  const barWrap = el('div', { class: 'bar indeterminate' }, bar);
  const phase = el('div', { class: 'progress-phase' }, phaseLabel(p));
  progressRefs = { phase, bar, barWrap, counts };
  const header = el('header', { class: 'header' }, el('div', { class: 'title' }, t('appName')));
  const body = el(
    'div',
    { class: 'scroll' },
    el('div', { class: 'progress-wrap' }, el('div', { class: 'progress-title' }, t('scanning')), barWrap, phase, grid),
  );
  const footer = el('footer', { class: 'footer' }, el('div', { class: 'spacer' }), el('button', { class: 'btn btn-secondary', onclick: () => send({ type: 'cancel-scan' }) }, t('cancelScan')));
  updateProgress(p);
  return el('div', { class: 'screen' }, header, body, footer);
}

function updateProgress(p: ScanProgress) {
  state.progress = p;
  if (!progressRefs || state.screen !== 'scanning') return;
  progressRefs.phase.textContent = phaseLabel(p);
  if (p.phase === 'scanning' || p.phase === 'finalizing') {
    progressRefs.barWrap.classList.remove('indeterminate');
    const pct = p.total ? Math.min(100, (p.scanned / p.total) * 100) : 100;
    progressRefs.bar.style.width = `${p.phase === 'finalizing' ? 100 : pct}%`;
  }
  for (const [cat, elc] of progressRefs.counts) {
    const n = p.found[cat] ?? 0;
    if (elc.textContent !== String(n)) {
      elc.textContent = String(n);
      elc.style.color = n ? 'var(--text)' : '';
    }
  }
}

// ---------------------------------------------------------------------------
// Écran 2 — Résultats
// ---------------------------------------------------------------------------

interface ResultsRefs {
  scoreValue: HTMLElement;
  ring: HTMLElement;
  ringFill: SVGCircleElement;
  summary: HTMLElement;
  chips: Map<Category, { chip: HTMLElement; count: HTMLElement }>;
  list: HTMLElement;
  footer: HTMLElement;
  scroll: HTMLElement;
}
let refs: ResultsRefs | null = null;
const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;

function allIssues(): Issue[] {
  return [...state.issues.values()];
}

function openIssues(): Issue[] {
  return allIssues().filter((i) => i.status === 'open');
}

function safeOpenIssues(): Issue[] {
  return openIssues().filter((i) => i.fixSafety === 'safe');
}

function currentScore(): number {
  return computeScore(allIssues(), state.result?.stats.nodesScanned ?? 0).total;
}

function matchesQuery(i: Issue, q: string): boolean {
  if (!q) return true;
  const hay = [state.i18n.ruleTitle(i.ruleId), i.currentValue, i.suggestion?.label ?? '', i.nodeName, i.nodePath.join(' '), i.ruleId, state.i18n.ruleMessage(i)]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function visibleIssues(): Issue[] {
  const f = state.filters;
  return allIssues().filter((i) => {
    if (f.categories.size && !f.categories.has(i.category)) return false;
    if (f.severity === 'errors' && i.severity !== 'error') return false;
    if (f.severity === 'errors-warnings' && i.severity === 'info') return false;
    if (f.status !== 'all' && i.status !== f.status) return false;
    return matchesQuery(i, f.query);
  });
}

function scoreLevel(score: number): 'high' | 'mid' | 'low' {
  return score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
}

function renderResults(): HTMLElement {
  const result = state.result!;
  const stats = result.stats;
  const scopeBadge = stats.scope === 'file' ? t('scopeBadgeFile') : stats.scope === 'selection' ? t('scopeBadgeSelection') : t('scopeBadgePage');

  const header = el(
    'header',
    { class: 'header' },
    el('button', { class: 'btn btn-icon', title: t('back'), 'aria-label': t('back'), onclick: () => goConfig() }, svgIcon('back')),
    el(
      'div',
      { class: 'title' },
      el('span', { class: 'scope-badge' }, scopeBadge),
      el('span', { class: 'sub' }, stats.scopeLabel),
      el('span', { class: 'sub' }, '· ', state.i18n.preset(state.settings.preset).name),
    ),
    el('button', { class: 'btn btn-icon', title: t('rescan'), 'aria-label': t('rescan'), onclick: () => startScan() }, svgIcon('refresh')),
    el('button', { class: 'btn btn-icon', title: t('export'), 'aria-label': t('export'), onclick: () => toggleMenu('export') }, svgIcon('export')),
    el('button', { class: 'btn btn-icon', title: t('settings'), 'aria-label': t('settings'), onclick: () => toggleMenu('settings') }, svgIcon('settings')),
  );

  const scroll = el('div', { class: 'scroll' });

  // Notices
  if (state.notice?.kind === 'cancelled') scroll.appendChild(el('div', { class: 'notice info' }, svgIcon('info'), el('span', {}, `${t('cancelled')} — ${t('cancelledBody')}`)));
  if (state.notice?.kind === 'error') scroll.appendChild(el('div', { class: 'notice' }, svgIcon('alert'), el('span', {}, `${t('errorTitle')} — ${t('errorBody', { message: state.notice.message })}`)));
  for (const w of stats.warnings) {
    let text = '';
    if (w === 'library-cap') text = t('warnLibraryCap');
    else if (w === 'libraries-unavailable') text = t('warnLibrariesUnavailable');
    else if (w.startsWith('library:')) text = t('warnLibrary', { name: w.slice(8) });
    else if (w.startsWith('rule:')) text = t('warnRule', { rule: state.i18n.ruleTitle(w.slice(5)) });
    if (text) scroll.appendChild(el('div', { class: 'notice' }, svgIcon('alert'), el('span', {}, text)));
  }
  if (stats.tokens.colorVariables + stats.tokens.floatVariables + stats.tokens.textStyles + stats.tokens.paintStyles === 0) {
    scroll.appendChild(el('div', { class: 'notice info' }, svgIcon('info'), el('span', {}, t('noTokens'))));
  }

  // Score
  const score = currentScore();
  const ringFill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringFill.setAttribute('class', 'fill');
  ringFill.setAttribute('cx', '28');
  ringFill.setAttribute('cy', '28');
  ringFill.setAttribute('r', String(RING_R));
  ringFill.setAttribute('stroke-dasharray', String(RING_C));
  ringFill.setAttribute('stroke-dashoffset', String(RING_C));
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('class', 'track');
  track.setAttribute('cx', '28');
  track.setAttribute('cy', '28');
  track.setAttribute('r', String(RING_R));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 56 56');
  svg.setAttribute('width', '56');
  svg.setAttribute('height', '56');
  svg.append(track, ringFill);
  const scoreValue = el('div', { class: 'score-value num' }, '0');
  const ring = el('div', { class: 'score-ring', 'data-level': scoreLevel(score), title: t('scoreHint') }, svg, scoreValue);
  const summary = el('div', { class: 'score-meta' });
  const scoreCard = el(
    'div',
    { class: 'score-card' },
    ring,
    el('div', { class: 'score-label' }, t('health'), el('span', { class: 'tag' }, t('done', { s: (stats.durationMs / 1000).toFixed(1) }))),
    summary,
  );
  scroll.appendChild(scoreCard);

  // Chips
  const chips = new Map<Category, { chip: HTMLElement; count: HTMLElement }>();
  const chipsEl = el('div', { class: 'chips', role: 'group', 'aria-label': t('byCategory') });
  for (const c of CATEGORIES) {
    const count = el('span', { class: 'count num' }, '0');
    const chip = el(
      'button',
      {
        class: 'chip',
        'aria-pressed': String(state.filters.categories.has(c)),
        onclick: () => {
          if (state.filters.categories.has(c)) state.filters.categories.delete(c);
          else state.filters.categories.add(c);
          chip.setAttribute('aria-pressed', String(state.filters.categories.has(c)));
          renderList();
        },
      },
      state.i18n.category(c, true),
      count,
    );
    chips.set(c, { chip, count });
    chipsEl.appendChild(chip);
  }
  scroll.appendChild(chipsEl);

  // Toolbar
  const searchInput = el('input', {
    type: 'search',
    placeholder: t('search'),
    title: t('searchTitle'),
    value: state.filters.query,
    'aria-label': t('searchTitle'),
    oninput: (e) => {
      state.filters.query = (e.target as HTMLInputElement).value;
      renderList();
    },
  }) as HTMLInputElement;
  searchInput.id = 'search-input';
  const sevSelect = el(
    'select',
    {
      'aria-label': t('filterSeverity'),
      onchange: (e) => {
        state.filters.severity = (e.target as HTMLSelectElement).value as SeverityFilter;
        renderList();
      },
    },
    el('option', { value: 'all', selected: state.filters.severity === 'all' }, t('sevAll')),
    el('option', { value: 'errors', selected: state.filters.severity === 'errors' }, t('sevErrors')),
    el('option', { value: 'errors-warnings', selected: state.filters.severity === 'errors-warnings' }, t('sevErrorsWarnings')),
  );
  const statusSelect = el(
    'select',
    {
      'aria-label': t('filterStatus'),
      onchange: (e) => {
        state.filters.status = (e.target as HTMLSelectElement).value as StatusFilter;
        renderList();
      },
    },
    el('option', { value: 'open', selected: state.filters.status === 'open' }, t('statusOpen')),
    el('option', { value: 'fixed', selected: state.filters.status === 'fixed' }, t('statusFixed')),
    el('option', { value: 'ignored', selected: state.filters.status === 'ignored' }, t('statusIgnored')),
    el('option', { value: 'all', selected: state.filters.status === 'all' }, t('all')),
  );
  scroll.appendChild(
    el(
      'div',
      { class: 'toolbar' },
      el('div', { class: 'search' }, svgIcon('search'), searchInput, el('span', { class: 'kbd', 'aria-hidden': 'true' }, '/')),
      el('div', { class: 'select sev-select' }, sevSelect),
      el('div', { class: 'select' }, statusSelect),
    ),
  );

  const list = el('div', { class: 'list', role: 'list' });
  scroll.appendChild(list);
  scroll.appendChild(el('div', { class: 'kbd-hint' }, t('keyboardHint')));

  const footer = el('footer', { class: 'footer' });

  refs = { scoreValue, ring, ringFill, summary, chips, list, footer, scroll };
  state.lastScore = 0;
  updateCounters(true);
  renderList();
  renderFooter();
  return el('div', { class: 'screen' }, header, scroll, footer);
}

function updateCounters(animate = false) {
  if (!refs) return;
  const issues = allIssues();
  const open = issues.filter((i) => i.status === 'open');
  const score = currentScore();
  const from = state.lastScore;
  animateNumber(from, score, animate ? 300 : 300, (v) => (refs!.scoreValue.textContent = String(v)));
  state.lastScore = score;
  refs.ringFill.setAttribute('stroke-dashoffset', String(RING_C * (1 - score / 100)));
  refs.ring.setAttribute('data-level', scoreLevel(score));

  const sev = countBySeverity(issues);
  const safe = open.filter((i) => i.fixSafety === 'safe').length;
  const review = open.filter((i) => i.fixSafety === 'review').length;
  clear(refs.summary);
  append(refs.summary, [
    el('span', { class: 'num' }, t('counts', { e: sev.error, w: sev.warning, i: sev.info })),
    el('span', { class: 'num' }, t('nodesScanned', { n: state.result?.stats.nodesScanned ?? 0 })),
    safe ? el('span', { class: 'num', style: 'color:var(--text-success)' }, state.i18n.plural(safe, 'safeFixesOne', 'safeFixes')) : null,
    review ? el('span', { class: 'num' }, state.i18n.plural(review, 'reviewOne', 'reviewItems')) : null,
  ]);
  for (const [cat, { chip, count }] of refs.chips) {
    const n = open.filter((i) => i.category === cat).length;
    if (count.textContent !== String(n)) {
      count.textContent = String(n);
      chip.classList.remove('chip-fill');
      void chip.offsetWidth;
      chip.classList.add('chip-fill');
    }
    chip.classList.toggle('empty', n === 0 && !state.filters.categories.has(cat));
  }
  renderFooter();
}

function renderFooter() {
  if (!refs) return;
  const footer = refs.footer;
  clear(footer);
  if (state.fixing) {
    const pct = state.fixing.total ? (state.fixing.done / state.fixing.total) * 100 : 0;
    footer.append(
      el('div', { class: 'fix-progress' }, el('span', {}, t('fixing', { done: state.fixing.done, total: state.fixing.total })), el('div', { class: 'bar' }, el('i', { style: `width:${pct}%` }))),
    );
    return;
  }
  const safe = safeOpenIssues();
  if (safe.length) {
    footer.append(
      el(
        'button',
        {
          class: 'btn btn-success',
          onclick: () => {
            state.confirm = {
              title: t('fixAllSafe', { n: safe.length }),
              body: t('fixAllConfirm', { n: safe.length }),
              confirmLabel: t('apply'),
              onConfirm: () => fixMany(safe.map((i) => i.id)),
            };
            render();
          },
        },
        svgIcon('wand'),
        safe.length === 1 ? t('fixAllSafeOne') : t('fixAllSafe', { n: safe.length }),
      ),
    );
  }
  footer.append(el('div', { class: 'spacer' }));
  footer.append(el('button', { class: 'btn btn-secondary', onclick: () => toggleMenu('export') }, svgIcon('export'), t('export')));
}

function groupKeyOpen(key: string, groupsInCategory: number, indexInCategory: number): boolean {
  if (state.openGroups.has(key)) return true;
  if (state.closedGroups.has(key)) return false;
  return groupsInCategory <= 4 || indexInCategory < 2;
}

function renderList() {
  if (!refs) return;
  const list = refs.list;
  const scrollTop = refs.scroll.scrollTop;
  clear(list);
  const total = allIssues().length;
  const visible = visibleIssues();

  if (total === 0) {
    list.appendChild(renderEmptyState());
    return;
  }
  if (!visible.length) {
    list.appendChild(
      el(
        'div',
        { class: 'state-box' },
        el('div', { class: 'big-icon neutral' }, svgIcon('search', 18)),
        el('p', {}, t('emptyFiltered')),
        el(
          'div',
          { class: 'row' },
          el(
            'button',
            {
              class: 'btn btn-secondary btn-sm',
              onclick: () => {
                state.filters = { categories: new Set(), severity: 'all', status: 'open', query: '' };
                render();
              },
            },
            t('resetFilters'),
          ),
        ),
      ),
    );
    return;
  }

  for (const cat of CATEGORIES) {
    const ofCat = visible.filter((i) => i.category === cat);
    if (!ofCat.length) continue;
    const groups = new Map<string, Issue[]>();
    for (const i of ofCat) groups.set(i.groupKey, [...(groups.get(i.groupKey) ?? []), i]);
    list.appendChild(el('div', { class: 'cat-head' }, state.i18n.category(cat), el('span', { class: 'count num' }, String(ofCat.length))));
    let idx = 0;
    for (const [key, issues] of groups) {
      list.appendChild(renderGroup(key, issues, groupKeyOpen(key, groups.size, idx)));
      idx++;
    }
  }
  refs.scroll.scrollTop = scrollTop;
}

function swatchEl(hex: string | undefined, size?: number): HTMLElement | null {
  if (!hex) return null;
  const sw = el('span', { class: 'swatch', style: size ? `width:${size}px;height:${size}px` : '' }, el('i', { style: `background:${hex}` }));
  return sw;
}

function renderGroup(key: string, issues: Issue[], open: boolean): HTMLElement {
  const first = issues[0];
  const openCount = issues.filter((i) => i.status === 'open').length;
  const safeIds = issues.filter((i) => i.status === 'open' && i.fixSafety === 'safe').map((i) => i.id);
  const group = el('div', { class: 'group', 'data-open': String(open), role: 'listitem' });
  const head = el(
    'button',
    {
      class: 'group-head',
      'aria-expanded': String(open),
      onclick: () => {
        const now = group.getAttribute('data-open') !== 'true';
        group.setAttribute('data-open', String(now));
        head.setAttribute('aria-expanded', String(now));
        if (now) {
          state.openGroups.add(key);
          state.closedGroups.delete(key);
        } else {
          state.closedGroups.add(key);
          state.openGroups.delete(key);
        }
        body.hidden = !now;
      },
    },
    el('span', { class: 'caret' }),
    el('span', { class: `dot dot-${first.severity}` }),
    el('span', { class: 'g-title' }, state.i18n.ruleTitle(first.ruleId)),
    el('span', { class: 'g-count num' }, issues.length === 1 ? t('occurrenceOne') : t('occurrences', { n: issues.length })),
  );
  const valueLine = el(
    'div',
    { class: 'group-value' },
    swatchEl(first.swatch),
    el('span', { class: 'value' }, first.currentValue),
    first.suggestion ? el('span', { class: 'arrow' }, '→') : null,
    first.suggestion ? swatchEl(first.suggestion.swatch) : null,
    first.suggestion ? el('span', { class: 'value' }, first.suggestion.label) : null,
    first.fixSafety === 'safe' ? el('span', { class: 'tag tag-safe' }, t('safeFix')) : first.fixSafety === 'review' ? el('span', { class: 'tag tag-review' }, t('reviewFix')) : null,
  );
  const actions = el('div', { class: 'group-actions' });
  if (safeIds.length > 1 && openCount > 0) {
    actions.appendChild(el('button', { class: 'btn btn-secondary btn-sm', onclick: () => fixMany(safeIds) }, svgIcon('wand'), t('applyTo', { n: safeIds.length })));
  }
  const body = el('div', { class: 'issues' }, ...issues.map((i) => renderIssueRow(i)));
  body.hidden = !open;
  group.append(head, valueLine, actions.childElementCount ? actions : '', body);
  return group;
}

function pathEl(issue: Issue): HTMLElement {
  const parts = issue.nodePath.slice(1); // sans la page : déjà connue
  return el('div', { class: 'path', title: [...issue.nodePath, issue.nodeName].join(' › ') }, el('span', {}, parts.join(' › ') || issue.nodePath[0] || ''));
}

function renderIssueRow(issue: Issue): HTMLElement {
  const row = el('div', {
    class: `issue${issue.status === 'fixed' ? ' is-fixed' : ''}${issue.status === 'ignored' ? ' is-ignored' : ''}`,
    role: 'button',
    tabindex: '0',
    'data-id': issue.id,
    'aria-selected': String(state.detailId === issue.id),
    onclick: (e) => {
      if ((e.target as HTMLElement).closest('.actions')) return;
      openDetail(issue.id);
    },
    onkeydown: (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter') {
        ke.preventDefault();
        openDetail(issue.id);
      } else if (ke.key.toLowerCase() === 'f' && !ke.metaKey && !ke.ctrlKey) {
        ke.preventDefault();
        if (issue.status === 'open' && issue.fixSafety !== 'none') fixOne(issue.id);
      } else if (ke.key.toLowerCase() === 'v') {
        ke.preventDefault();
        viewIssue(issue);
      }
    },
  });
  const actions = el('div', { class: 'actions' });
  actions.appendChild(
    el(
      'button',
      {
        class: 'btn btn-icon',
        title: t('view'),
        'aria-label': t('view'),
        onclick: (e) => {
          e.stopPropagation();
          viewIssue(issue);
        },
      },
      svgIcon('target'),
    ),
  );
  if (issue.status === 'open' && issue.fixSafety !== 'none') {
    actions.appendChild(
      el(
        'button',
        {
          class: 'btn btn-icon',
          title: issue.fixSafety === 'safe' ? t('fix') : t('review'),
          'aria-label': issue.fixSafety === 'safe' ? t('fix') : t('review'),
          onclick: (e) => {
            e.stopPropagation();
            if (issue.fixSafety === 'safe') fixOne(issue.id);
            else openDetail(issue.id);
          },
        },
        svgIcon('wand'),
      ),
    );
  }
  if (issue.status === 'open') {
    actions.appendChild(
      el(
        'button',
        {
          class: 'btn btn-icon',
          title: t('ignore'),
          'aria-label': t('ignore'),
          onclick: (e) => {
            e.stopPropagation();
            setIgnored(issue.id, true);
          },
        },
        svgIcon('eye-off'),
      ),
    );
  } else if (issue.status === 'ignored') {
    actions.appendChild(
      el(
        'button',
        {
          class: 'btn btn-icon',
          title: t('unignore'),
          'aria-label': t('unignore'),
          onclick: (e) => {
            e.stopPropagation();
            setIgnored(issue.id, false);
          },
        },
        svgIcon('eye'),
      ),
    );
  }
  row.append(
    el('span', { class: `dot dot-${issue.severity}` }),
    el('div', { class: 'meta' }, el('div', { class: 'name' }, issue.nodeName), pathEl(issue)),
    el(
      'div',
      { class: 'row', style: 'gap:6px' },
      issue.status === 'fixed' ? el('span', { class: 'state' }, t('fixed')) : issue.status === 'ignored' ? el('span', { class: 'state' }, t('ignored')) : null,
      actions,
    ),
  );
  return row;
}

function refreshRow(id: string, justFixed = false) {
  const issue = state.issues.get(id);
  if (!issue || !refs) return;
  const old = refs.list.querySelector<HTMLElement>(`.issue[data-id="${CSS.escape(id)}"]`);
  if (!old) return;
  const fresh = renderIssueRow(issue);
  if (justFixed) fresh.classList.add('just-fixed');
  old.replaceWith(fresh);
}

function renderEmptyState(): HTMLElement {
  const stats = state.result!.stats;
  return el(
    'div',
    { class: 'state-box' },
    el('div', { class: 'big-icon' }, svgIcon('check', 18)),
    el('h2', {}, t('emptyTitle')),
    el('p', {}, t('emptyBody', { scope: stats.scopeLabel, preset: state.i18n.preset(state.settings.preset).name })),
    el(
      'div',
      { class: 'row' },
      state.settings.preset !== 'strict'
        ? el(
            'button',
            {
              class: 'btn btn-secondary btn-sm',
              onclick: () => {
                state.settings.preset = 'strict';
                state.settings.disabledRules = [];
                state.settings.enabledRules = [];
                persistSettings();
                startScan();
              },
            },
            t('emptyStrict'),
          )
        : null,
      el('button', { class: 'btn btn-secondary btn-sm', onclick: () => goConfig() }, t('newScan')),
    ),
  );
}

function goConfig() {
  state.screen = 'config';
  state.detailId = null;
  state.menu = null;
  render();
}

// ---------------------------------------------------------------------------
// Écran 3 — Détail d'une issue
// ---------------------------------------------------------------------------

function openDetail(id: string) {
  state.detailId = id;
  const prev = app.querySelector('.detail');
  if (prev) prev.remove();
  app.insertBefore(renderDetail(id), toastsEl);
  refs?.list.querySelectorAll('.issue[aria-selected="true"]').forEach((r) => r.setAttribute('aria-selected', 'false'));
  refs?.list.querySelector(`.issue[data-id="${CSS.escape(id)}"]`)?.setAttribute('aria-selected', 'true');
}

function closeDetail() {
  const panel = app.querySelector<HTMLElement>('.detail');
  state.detailId = null;
  if (!panel) return;
  panel.classList.add('leaving');
  const done = () => panel.remove();
  panel.addEventListener('animationend', done, { once: true });
  setTimeout(done, 260);
  refs?.list.querySelectorAll('.issue[aria-selected="true"]').forEach((r) => r.setAttribute('aria-selected', 'false'));
}

function renderDetail(id: string): HTMLElement {
  const issue = state.issues.get(id);
  if (!issue) return el('div');
  const i18n = state.i18n;
  const meta = RULE_BY_ID[issue.ruleId];
  const sameGroup = allIssues().filter((o) => o.groupKey === issue.groupKey && o.status === 'open' && o.id !== issue.id);

  const header = el(
    'header',
    { class: 'header' },
    el('button', { class: 'btn btn-icon', title: t('back'), 'aria-label': t('back'), onclick: () => closeDetail() }, svgIcon('back')),
    el('div', { class: 'title' }, i18n.category(issue.category)),
    el('button', { class: 'btn btn-icon', title: t('view'), 'aria-label': t('view'), onclick: () => viewIssue(issue) }, svgIcon('target')),
  );

  const tags = el(
    'div',
    { class: 'tags' },
    el('span', { class: `tag tag-${issue.severity}` }, i18n.severity(issue.severity)),
    issue.status === 'fixed'
      ? el('span', { class: 'tag tag-fixed' }, t('fixed'))
      : issue.status === 'ignored'
        ? el('span', { class: 'tag' }, t('ignored'))
        : issue.fixSafety === 'safe'
          ? el('span', { class: 'tag tag-safe' }, t('safeFix'))
          : issue.fixSafety === 'review'
            ? el('span', { class: 'tag tag-review' }, t('reviewFix'))
            : el('span', { class: 'tag' }, t('noFix')),
    el('span', { class: 'tag mono' }, issue.ruleId),
  );

  const compare = el(
    'div',
    { class: 'compare' },
    el(
      'div',
      { class: 'cell' },
      swatchEl(issue.swatch, 16),
      el('div', { class: 'txt' }, el('div', { class: 'main value' }, issue.currentValue), el('div', { class: 'sub' }, t('current'))),
    ),
    el('span', { class: 'arrow' }, '→'),
    issue.suggestion
      ? el(
          'div',
          { class: 'cell' },
          swatchEl(issue.suggestion.swatch, 16),
          el(
            'div',
            { class: 'txt' },
            el('div', { class: 'main' }, issue.suggestion.label),
            el('div', { class: 'sub' }, [issue.suggestion.value, issue.suggestion.source].filter(Boolean).join(' · ') || t('suggested')),
          ),
        )
      : el('div', { class: 'cell' }, el('div', { class: 'txt' }, el('div', { class: 'sub' }, t('noMatchHint')))),
  );

  const alternatives = issue.suggestion?.alternatives?.length
    ? el(
        'div',
        {},
        el('div', { class: 'k' }, t('alternatives')),
        el(
          'div',
          { class: 'alt-list' },
          ...issue.suggestion.alternatives.map((a) =>
            el(
              'button',
              {
                class: 'alt',
                disabled: issue.status !== 'open',
                title: t('applySuggestion'),
                onclick: () => fixOne(issue.id, a.id),
              },
              swatchEl(a.swatch),
              el('span', { class: 'main' }, a.label),
              a.value ? el('span', { class: 'sub' }, a.value) : null,
              svgIcon('wand'),
            ),
          ),
        ),
      )
    : null;

  const pathParts = [...issue.nodePath, issue.nodeName];
  const where = el(
    'div',
    { class: 'path-list' },
    ...pathParts.flatMap((p, idx) => [
      idx ? el('span', { class: 'sep' }, '›') : null,
      el('span', { class: idx === pathParts.length - 1 ? 'last' : '' }, p),
    ]),
  );

  const body = el(
    'div',
    { class: 'scroll' },
    el(
      'div',
      { class: 'section' },
      el('h1', {}, i18n.ruleTitle(issue.ruleId)),
      tags,
      el('p', { style: 'margin:0 0 12px' }, i18n.ruleMessage(issue)),
      el(
        'div',
        { class: 'kv' },
        compare,
        alternatives,
        el('div', {}, el('div', { class: 'k' }, t('where')), where),
        el('div', {}, el('div', { class: 'k' }, t('why')), el('div', { class: 'v' }, i18n.ruleWhy(issue))),
        el('div', {}, el('div', { class: 'k' }, t('whatToDo')), el('div', { class: 'v' }, i18n.ruleSuggestion(issue))),
      ),
    ),
  );

  const footer = el('footer', { class: 'footer' });
  if (issue.status === 'open' && issue.fixSafety !== 'none') {
    footer.appendChild(el('button', { class: 'btn btn-primary', onclick: () => fixOne(issue.id) }, svgIcon('wand'), t('applySuggestion')));
    const groupSafe = sameGroup.filter((o) => o.fixSafety === issue.fixSafety);
    if (groupSafe.length) {
      footer.appendChild(
        el('button', { class: 'btn btn-secondary', onclick: () => fixMany([issue.id, ...groupSafe.map((o) => o.id)]) }, t('applyTo', { n: groupSafe.length + 1 })),
      );
    }
  }
  if (issue.status === 'open') footer.appendChild(el('button', { class: 'btn btn-secondary', onclick: () => setIgnored(issue.id, true) }, svgIcon('eye-off'), t('ignoreIssue')));
  if (issue.status === 'ignored') footer.appendChild(el('button', { class: 'btn btn-secondary', onclick: () => setIgnored(issue.id, false) }, svgIcon('eye'), t('unignore')));
  footer.appendChild(
    el(
      'button',
      {
        class: 'btn btn-ghost',
        onclick: () => {
          toggleRule(issue.ruleId, false);
          toast({ message: t('toastRuleDisabled'), timeout: 4000 });
        },
      },
      t('ignoreRule'),
    ),
  );
  if (meta?.docUrl) footer.appendChild(el('button', { class: 'btn btn-ghost', onclick: () => send({ type: 'open-url', url: meta.docUrl! }) }, svgIcon('external'), t('openDoc')));

  return el('div', { class: 'detail', role: 'dialog', 'aria-label': i18n.ruleTitle(issue.ruleId) }, header, body, footer);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function viewIssue(issue: Issue) {
  send({ type: 'select-node', nodeId: issue.nodeId, pageId: issue.pageId });
}

function fixOne(issueId: string, alternativeId?: string) {
  if (state.pendingFixIds.has(issueId)) return;
  state.pendingFixIds.add(issueId);
  send({ type: 'fix', issueId, alternativeId });
}

function fixMany(ids: string[]) {
  state.confirm = null;
  if (!ids.length) return;
  for (const id of ids) state.pendingFixIds.add(id);
  state.fixing = { done: 0, total: ids.length };
  render();
  send({ type: 'fix-many', issueIds: ids });
}

function setIgnored(issueId: string, ignored: boolean) {
  const issue = state.issues.get(issueId);
  if (!issue) return;
  issue.status = ignored ? 'ignored' : 'open';
  send({ type: 'ignore-issue', issueId, ignored });
  refreshRow(issueId);
  updateCounters();
  if (state.detailId === issueId) openDetail(issueId);
  toast({
    message: ignored ? t('toastIgnored') : t('toastUnignored'),
    actionLabel: t('undo'),
    onAction: () => setIgnoredSilently(issueId, !ignored),
    timeout: 6000,
  });
}

function setIgnoredSilently(issueId: string, ignored: boolean) {
  const issue = state.issues.get(issueId);
  if (!issue) return;
  issue.status = ignored ? 'ignored' : 'open';
  send({ type: 'ignore-issue', issueId, ignored });
  refreshRow(issueId);
  updateCounters();
  if (state.detailId === issueId) openDetail(issueId);
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
  const wasBatch = state.fixing !== null;
  state.fixing = null;
  if (wasBatch) {
    render();
  } else {
    for (const i of fixed) refreshRow(i.id, true);
    updateCounters();
    if (state.detailId && fixed.some((i) => i.id === state.detailId)) openDetail(state.detailId);
  }
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
  if (state.screen === 'results') {
    for (const id of issueIds) refreshRow(id);
    updateCounters();
    if (state.detailId && issueIds.includes(state.detailId)) openDetail(state.detailId);
  }
  toast({ message: issueIds.length === 1 ? t('toastUndoneOne') : t('toastUndone', { n: issueIds.length }), timeout: 4000 });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function reportLabels(): ReportLabels {
  const i18n = state.i18n;
  return {
    title: t('appName'),
    generated: state.settings.locale === 'fr' ? 'Généré' : 'Generated',
    scope: t('scope'),
    nodes: state.settings.locale === 'fr' ? 'Calques analysés' : 'Layers checked',
    duration: state.settings.locale === 'fr' ? 'Durée' : 'Duration',
    score: t('health'),
    summary: state.settings.locale === 'fr' ? 'Résumé' : 'Summary',
    category: (c) => i18n.category(c),
    severity: (s) => i18n.severity(s),
    rule: (r) => i18n.ruleTitle(r),
    message: (i) => i18n.ruleMessage(i),
    status: (s) => (s === 'open' ? t('statusOpen') : s === 'fixed' ? t('fixed') : t('ignored')),
    columns: {
      rule: state.settings.locale === 'fr' ? 'Règle' : 'Rule',
      severity: t('filterSeverity'),
      category: state.settings.locale === 'fr' ? 'Catégorie' : 'Category',
      layer: state.settings.locale === 'fr' ? 'Calque' : 'Layer',
      path: state.settings.locale === 'fr' ? 'Chemin' : 'Path',
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
  const md = buildMarkdownReport(allIssues(), state.result.stats, computeScore(allIssues(), state.result.stats.nodesScanned), reportLabels(), state.fileName, new Date());
  if (copy) {
    copyText(md).then((ok) => toast({ message: ok ? t('copied') : t('toastFixFailed', { n: 1 }), timeout: 3000, error: !ok }));
  } else {
    download(`${fileStem()}.md`, md, 'text/markdown;charset=utf-8');
    toast({ message: t('downloaded'), timeout: 3000 });
  }
}

function exportCsv() {
  const csv = buildCsvReport(allIssues(), reportLabels());
  download(`${fileStem()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  toast({ message: t('downloaded'), timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Menus, dialogues, toasts
// ---------------------------------------------------------------------------

function toggleMenu(kind: 'export' | 'settings') {
  state.menu = state.menu === kind ? null : kind;
  const existing = app.querySelector('.menu');
  if (existing) existing.remove();
  if (state.menu) app.insertBefore(renderMenu(state.menu), toastsEl);
}

function renderMenu(kind: 'export' | 'settings'): HTMLElement {
  const close = () => {
    state.menu = null;
    app.querySelector('.menu')?.remove();
    document.removeEventListener('mousedown', onOutside, true);
  };
  const onOutside = (e: Event) => {
    if (!(e.target as HTMLElement).closest('.menu')) close();
  };
  setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);

  if (kind === 'export') {
    const disabled = !state.result;
    return el(
      'div',
      { class: 'menu', role: 'menu' },
      el('button', { role: 'menuitem', disabled, onclick: () => (close(), exportMarkdown(false)) }, svgIcon('export'), t('exportMd')),
      el('button', { role: 'menuitem', disabled, onclick: () => (close(), exportMarkdown(true)) }, svgIcon('check'), t('copyMd')),
      el('button', { role: 'menuitem', disabled, onclick: () => (close(), exportCsv()) }, svgIcon('export'), t('exportCsv')),
    );
  }
  return el(
    'div',
    { class: 'menu', role: 'menu', style: 'min-width:220px' },
    el('div', { class: 'hint', style: 'padding:6px 10px 2px' }, t('language')),
    el(
      'div',
      { class: 'segmented', style: 'margin:0 6px 6px' },
      ...(['fr', 'en'] as const).map((loc) =>
        el(
          'button',
          {
            'aria-pressed': String(state.settings.locale === loc),
            onclick: () => {
              state.settings.locale = loc;
              state.i18n = new I18n(loc);
              document.documentElement.lang = loc;
              persistSettings();
              state.menu = null;
              render();
            },
          },
          loc === 'fr' ? 'Français' : 'English',
        ),
      ),
    ),
    el('div', { class: 'sep' }),
    el('div', { style: 'padding:6px 10px' }, el('div', { style: 'font-weight:600;margin-bottom:2px' }, t('aboutTitle')), el('div', { class: 'hint' }, t('aboutBody'))),
    el('div', { class: 'hint', style: 'padding:2px 10px 6px' }, `${t('appName')} ${t('version')}`),
  );
}

function renderConfirm(c: Confirm): HTMLElement {
  const cancel = () => {
    state.confirm = null;
    render();
  };
  const dialog = el(
    'div',
    { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': c.title },
    el('h2', {}, c.title),
    el('p', {}, c.body),
    el(
      'div',
      { class: 'row' },
      el('button', { class: 'btn btn-secondary', onclick: cancel }, t('cancel')),
      el('button', { class: `btn ${c.danger ? 'btn-primary' : 'btn-primary'}`, onclick: () => c.onConfirm() }, c.confirmLabel),
    ),
  );
  const overlay = el('div', { class: 'overlay', onclick: (e) => e.target === e.currentTarget && cancel() }, dialog);
  setTimeout(() => (dialog.querySelector('.btn-primary') as HTMLElement | null)?.focus(), 0);
  return overlay;
}

function toast(opts: Omit<Toast, 'id'>) {
  const toastItem: Toast = { id: ++state.toastSeq, ...opts };
  state.toasts.push(toastItem);
  if (state.toasts.length > 3) dismissToast(state.toasts[0].id);
  toastsEl?.appendChild(renderToast(toastItem));
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

function renderToast(toastItem: Toast): HTMLElement {
  let remaining = toastItem.timeout;
  let startedAt = performance.now();
  let timer = window.setTimeout(() => dismissToast(toastItem.id), remaining);
  const progress = el('span', { class: 'progress', style: `animation: shrink ${toastItem.timeout}ms linear forwards` });
  const node = el(
    'div',
    {
      class: 'toast',
      role: 'status',
      'data-toast': String(toastItem.id),
      style: toastItem.error ? 'background:var(--bg-danger)' : '',
      onmouseenter: () => {
        clearTimeout(timer);
        remaining -= performance.now() - startedAt;
      },
      onmouseleave: () => {
        startedAt = performance.now();
        timer = window.setTimeout(() => dismissToast(toastItem.id), Math.max(800, remaining));
      },
    },
    el('span', { class: 'msg' }, toastItem.message),
    toastItem.actionLabel
      ? el(
          'button',
          {
            class: 'btn',
            onclick: () => {
              toastItem.onAction?.();
              dismissToast(toastItem.id);
            },
          },
          toastItem.actionLabel,
        )
      : null,
    el('button', { class: 'btn btn-icon', 'aria-label': t('cancel'), style: 'color:inherit;width:22px;height:22px', onclick: () => dismissToast(toastItem.id) }, svgIcon('close', 12)),
    progress,
  );
  return node;
}

// ---------------------------------------------------------------------------
// Redimensionnement de la fenêtre
// ---------------------------------------------------------------------------

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
      const w = startW + (ev.clientX - startX);
      const h = startH + (ev.clientY - startY);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => send({ type: 'resize', width: Math.round(w), height: Math.round(h) }));
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

// ---------------------------------------------------------------------------
// Clavier global
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  const inInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';
  if (e.key === 'Escape') {
    if (state.menu) {
      state.menu = null;
      app.querySelector('.menu')?.remove();
    } else if (state.confirm) {
      state.confirm = null;
      render();
    } else if (state.detailId) {
      closeDetail();
    } else if (inInput && (target as HTMLInputElement).value) {
      (target as HTMLInputElement).value = '';
      state.filters.query = '';
      renderList();
    }
    return;
  }
  if (inInput) return;
  if (e.key === '/' && state.screen === 'results') {
    e.preventDefault();
    (document.getElementById('search-input') as HTMLInputElement | null)?.focus();
    return;
  }
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && state.screen === 'results' && !state.detailId) {
    const rows = [...app.querySelectorAll<HTMLElement>('.issue')].filter((r) => r.offsetParent !== null);
    if (!rows.length) return;
    e.preventDefault();
    const idx = rows.findIndex((r) => r === document.activeElement);
    const next = e.key === 'ArrowDown' ? Math.min(rows.length - 1, idx + 1) : Math.max(0, idx - 1);
    rows[next].focus();
    rows[next].scrollIntoView({ block: 'nearest' });
  }
  if (e.key === 'Enter' && state.screen === 'config' && (e.metaKey || e.ctrlKey)) requestScan();
});

// ---------------------------------------------------------------------------
// Messages du sandbox
// ---------------------------------------------------------------------------

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as PluginToUiMessage | undefined;
  if (!msg) return;
  switch (msg.type) {
    case 'init': {
      const stored = msg.settings;
      state.settings = { ...DEFAULT_SETTINGS, ...stored, options: { ...DEFAULT_SETTINGS.options, ...stored.options } };
      if (!stored.locale) state.settings.locale = detectLocale();
      state.i18n = new I18n(state.settings.locale);
      document.documentElement.lang = state.settings.locale;
      state.selectionCount = msg.selectionCount;
      state.fileName = msg.fileName;
      state.pageName = msg.pageName;
      state.pageCount = msg.pageCount;
      state.ignoredIssueIds = new Set(msg.ignoredIssueIds);
      render();
      break;
    }
    case 'selection':
      state.selectionCount = msg.count;
      if (state.screen === 'config') render();
      break;
    case 'page-changed':
      state.pageName = msg.pageName;
      if (state.screen === 'config') render();
      break;
    case 'scan-progress':
      updateProgress(msg.progress);
      break;
    case 'scan-done':
      receiveResult(msg.result, null);
      break;
    case 'scan-cancelled':
      if (msg.partial) receiveResult(msg.partial, { kind: 'cancelled' });
      else {
        state.screen = 'config';
        render();
      }
      break;
    case 'scan-error':
      if (msg.partial) receiveResult(msg.partial, { kind: 'error', message: msg.message });
      else {
        state.screen = 'config';
        render();
        toast({ message: `${t('errorTitle')} — ${msg.message}`, timeout: 8000, error: true });
      }
      break;
    case 'fix-progress':
      state.fixing = { done: msg.done, total: msg.total };
      renderFooter();
      break;
    case 'fix-done':
      onFixDone(msg.batchId, msg.outcomes, msg.undoable);
      break;
    case 'undo-done':
      onUndoDone(msg.issueIds);
      break;
    case 'ignored-updated':
      state.ignoredIssueIds = new Set(msg.ignoredIssueIds);
      break;
    case 'settings-saved':
      break;
  }
};

function receiveResult(result: ScanResult, notice: typeof state.notice) {
  state.result = result;
  state.issues = new Map(result.issues.map((i) => [i.id, { ...i }]));
  state.notice = notice;
  state.filters = { categories: new Set(), severity: 'all', status: 'open', query: '' };
  state.openGroups.clear();
  state.closedGroups.clear();
  state.detailId = null;
  state.fixing = null;
  state.pendingFixIds.clear();
  state.screen = 'results';
  render();
}

// Démarrage
render();
send({ type: 'ui-ready' });

export {};
