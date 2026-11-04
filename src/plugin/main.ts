/// <reference types="@figma/plugin-typings" />
import { resolveActiveRules } from '../shared/rules-catalog';
import type { FixOutcome, Issue, PluginToUiMessage, Settings, UiToPluginMessage } from '../shared/types';
import { countVariables, toCss, toDtcg, toTailwind } from '../shared/tokens-export';
import { DEFAULT_SETTINGS } from '../shared/types';
import { buildTokenModel } from './export/tokens-model';
import { applyPlan, FixError, type UndoEntry } from './fix/apply';
import type { FixPlan } from './fix/plans';
import { renderPreview, sweepPreviewClones, type PreviewItem } from './preview';
import { ALL_RULES } from './rules';
import { revealNodes } from './reveal';
import { runScan, type IssuePlans } from './scan/engine';

const SETTINGS_KEY = 'scd:settings:v1';
const IGNORED_KEY = 'scd:ignored';
/** Bornes de la taille mémorisée (colonne principale). */
const MIN_W = 560;
const MIN_H = 400;
const MAX_W = 1200;
const MAX_H = 1400;
/** Bornes de la fenêtre réelle : plus large avec le volet Comparer, plus basse une fois repliée. */
const MIN_TOTAL_W = 200;
const MIN_TOTAL_H = 40;
const MAX_TOTAL_W = 2200;

let settings: Settings = { ...DEFAULT_SETTINGS };
let uiSize = { ...DEFAULT_SETTINGS.window };
let scanning = false;
let cancelRequested = false;
const issues = new Map<string, Issue>();
const plans = new Map<string, IssuePlans>();
const journals = new Map<string, UndoEntry[]>();
let batchCounter = 0;
let previewRunning = false;
let previewPending: Extract<UiToPluginMessage, { type: 'preview' }> | null = null;
/** Dernière sélection posée par le plugin (clé triée), pour distinguer ses propres changements de sélection. */
let programmaticSelectionKey = '';

const post = (msg: PluginToUiMessage) => figma.ui.postMessage(msg);
const clamp = (v: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, v)));

function clampWindow(w: number, h: number) {
  return { width: clamp(w, MIN_W, MAX_W), height: clamp(h, MIN_H, MAX_H) };
}

async function loadSettings(): Promise<Settings> {
  try {
    const stored = (await figma.clientStorage.getAsync(SETTINGS_KEY)) as Partial<Settings> | undefined;
    if (stored && typeof stored === 'object') {
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        options: { ...DEFAULT_SETTINGS.options, ...(stored.options ?? {}) },
        window: clampWindow(stored.window?.width ?? DEFAULT_SETTINGS.window.width, stored.window?.height ?? DEFAULT_SETTINGS.window.height),
      };
    }
  } catch {
    /* stockage indisponible : valeurs par défaut */
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(partial: Partial<Settings>) {
  settings = {
    ...settings,
    ...partial,
    options: { ...settings.options, ...(partial.options ?? {}) },
    window: partial.window ? clampWindow(partial.window.width, partial.window.height) : settings.window,
  };
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  } catch {
    /* ignore */
  }
}

function readIgnored(): string[] {
  try {
    const raw = figma.root.getPluginData(IGNORED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIgnored(ids: string[]) {
  figma.root.setPluginData(IGNORED_KEY, JSON.stringify(ids));
}

function sendInit() {
  post({
    type: 'init',
    settings,
    selectionCount: figma.currentPage.selection.length,
    fileName: figma.root.name,
    pageName: figma.currentPage.name,
    pageCount: figma.root.children.length,
    ignoredIssueIds: readIgnored(),
    editorType: figma.editorType,
  });
}

async function handleScan(msg: Extract<UiToPluginMessage, { type: 'scan' }>) {
  if (scanning) return;
  scanning = true;
  cancelRequested = false;
  issues.clear();
  plans.clear();
  journals.clear();
  const activeRules = resolveActiveRules(msg.preset, msg.disabledRules, msg.enabledRules, msg.mode);
  const ignored = new Set(readIgnored());
  let lastProgressAt = 0;
  try {
    const out = await runScan(
      { scope: msg.scope, options: msg.options, activeRules, ignoredIssueIds: ignored, rules: ALL_RULES },
      (p) => {
        const now = Date.now();
        // Limite le débit des messages de progression (~30/s), sans perdre les changements de phase.
        if (now - lastProgressAt < 33 && p.phase === 'scanning' && p.scanned < p.total) return;
        lastProgressAt = now;
        post({ type: 'scan-progress', progress: p });
      },
      () => cancelRequested,
    );
    for (const issue of out.result.issues) issues.set(issue.id, issue);
    for (const [id, p] of out.plans) plans.set(id, p);
    if (out.cancelled) post({ type: 'scan-cancelled', partial: out.result });
    else post({ type: 'scan-done', result: out.result });
  } catch (e) {
    post({ type: 'scan-error', message: e instanceof Error ? e.message : String(e), partial: null });
  } finally {
    scanning = false;
  }
}

async function selectNodes(nodeIds: string[], pageId: string) {
  if (pageId && figma.currentPage.id !== pageId) {
    const page = await figma.getNodeByIdAsync(pageId);
    if (page && page.type === 'PAGE') await figma.setCurrentPageAsync(page);
  }
  const nodes: SceneNode[] = [];
  for (const id of nodeIds.slice(0, 200)) {
    const node = await figma.getNodeByIdAsync(id);
    if (node && node.type !== 'DOCUMENT' && node.type !== 'PAGE' && !(node as SceneNode).removed) nodes.push(node as SceneNode);
  }
  if (!nodes.length) {
    const fr = settings.locale !== 'en';
    if (nodeIds.some((id) => /^VariableID:|^S:/.test(id))) figma.notify(fr ? 'Cette ligne concerne une variable ou un style : ouvre le panneau Variables ou Styles.' : 'This row is about a variable or a style: open the Variables or Styles panel.', { timeout: 3000 });
    else figma.notify(fr ? 'Ce calque n’existe plus.' : 'This layer no longer exists.', { timeout: 2000 });
    return;
  }
  programmaticSelectionKey = selectionKey(nodes);
  figma.currentPage.selection = nodes;
  revealNodes(nodes, uiSize);
}

const selectionKey = (nodes: readonly SceneNode[]) => nodes.map((n) => n.id).sort().join('|');

function postSelection() {
  const sel = figma.currentPage.selection;
  const key = selectionKey(sel);
  post({ type: 'selection', count: sel.length, ids: sel.slice(0, 50).map((n) => n.id), programmatic: key !== '' && key === programmaticSelectionKey });
}

function planFor(issueId: string, alternativeId?: string): FixPlan | undefined {
  const p = plans.get(issueId);
  if (!p) return undefined;
  if (alternativeId && p.alternativePlans?.[alternativeId]) return p.alternativePlans[alternativeId];
  return p.plan;
}

async function applyMany(entries: { issueId: string; alternativeId?: string }[], reportProgress: boolean): Promise<void> {
  const batchId = `batch-${++batchCounter}`;
  const journal: UndoEntry[] = [];
  const outcomes: FixOutcome[] = [];
  figma.commitUndo();
  let done = 0;
  for (const { issueId, alternativeId } of entries) {
    const issue = issues.get(issueId);
    const plan = planFor(issueId, alternativeId);
    if (!issue || !plan) {
      outcomes.push({ issueId, ok: false, reason: 'no-plan' });
      continue;
    }
    try {
      const entry = await applyPlan(issueId, plan);
      journal.push(entry);
      issue.status = 'fixed';
      outcomes.push({ issueId, ok: true });
    } catch (e) {
      outcomes.push({ issueId, ok: false, reason: e instanceof FixError ? e.reason : 'unknown' });
    }
    done++;
    if (reportProgress && (done % 5 === 0 || done === entries.length)) post({ type: 'fix-progress', done, total: entries.length });
    if (done % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  if (journal.length) journals.set(batchId, journal);
  post({ type: 'fix-done', batchId, outcomes, undoable: journal.length > 0 });
}

async function undoBatch(batchId: string) {
  const journal = journals.get(batchId);
  if (!journal) return;
  journals.delete(batchId);
  figma.commitUndo();
  const restored: string[] = [];
  for (const entry of [...journal].reverse()) {
    try {
      await entry.revert();
      const issue = issues.get(entry.issueId);
      if (issue) issue.status = 'open';
      restored.push(entry.issueId);
    } catch {
      /* le node a pu disparaître : on continue */
    }
  }
  post({ type: 'undo-done', batchId, issueIds: restored });
}

/** Aperçus sérialisés : une demande à la fois, seule la plus récente en attente est conservée. */
async function handlePreview(msg: Extract<UiToPluginMessage, { type: 'preview' }>) {
  if (previewRunning) {
    previewPending = msg;
    return;
  }
  previewRunning = true;
  try {
    const items: PreviewItem[] = [];
    for (const { issueId, alternativeId } of msg.items) {
      const issue = issues.get(issueId);
      const plan = planFor(issueId, alternativeId);
      if (issue && plan && issue.status === 'open') items.push({ issueId, nodeId: issue.nodeId, plan });
    }
    const out = await renderPreview({ items, maxRoots: clamp(msg.maxRoots, 1, 6), rootId: msg.rootId ?? null, followSelection: msg.followSelection });
    post({ type: 'preview-done', requestId: msg.requestId, frames: out.frames, skipped: out.skipped, roots: out.roots });
  } catch (e) {
    post({ type: 'preview-error', requestId: msg.requestId, message: e instanceof Error ? e.message : String(e) });
  } finally {
    previewRunning = false;
    if (previewPending) {
      const next = previewPending;
      previewPending = null;
      void handlePreview(next);
    }
  }
}

figma.ui.onmessage = async (msg: UiToPluginMessage) => {
  switch (msg.type) {
    case 'ui-ready':
      sendInit();
      break;
    case 'scan':
      await saveSettings({ preset: msg.preset, options: msg.options, disabledRules: msg.disabledRules, enabledRules: msg.enabledRules });
      await handleScan(msg);
      break;
    case 'export-tokens': {
      try {
        const model = await buildTokenModel();
        const content = msg.format === 'dtcg' ? toDtcg(model) : msg.format === 'css' ? toCss(model) : toTailwind(model);
        post({ type: 'tokens-exported', format: msg.format, content, variables: countVariables(model) });
      } catch (e) {
        figma.notify(e instanceof Error ? e.message : String(e), { error: true, timeout: 4000 });
      }
      break;
    }
    case 'cancel-scan':
      cancelRequested = true;
      break;
    case 'select-node':
      await selectNodes([msg.nodeId], msg.pageId);
      break;
    case 'select-nodes':
      await selectNodes(msg.nodeIds, msg.pageId);
      break;
    case 'fix':
      await applyMany([{ issueId: msg.issueId, alternativeId: msg.alternativeId }], false);
      break;
    case 'fix-many':
      await applyMany(msg.items, msg.items.length > 3);
      break;
    case 'undo':
      await undoBatch(msg.batchId);
      break;
    case 'preview':
      await handlePreview(msg);
      break;
    case 'ignore-issue': {
      const set = new Set(readIgnored());
      if (msg.ignored) set.add(msg.issueId);
      else set.delete(msg.issueId);
      writeIgnored([...set]);
      const issue = issues.get(msg.issueId);
      if (issue) issue.status = msg.ignored ? 'ignored' : 'open';
      post({ type: 'ignored-updated', ignoredIssueIds: [...set] });
      break;
    }
    case 'save-settings':
      await saveSettings(msg.settings);
      post({ type: 'settings-saved', settings });
      break;
    case 'resize': {
      const total = { width: clamp(msg.width, MIN_TOTAL_W, MAX_TOTAL_W), height: clamp(msg.height, MIN_TOTAL_H, MAX_H) };
      figma.ui.resize(total.width, total.height);
      uiSize = total;
      if (msg.persist !== false) await saveSettings({ window: clampWindow(msg.baseWidth ?? total.width, total.height) });
      break;
    }
    case 'notify':
      figma.notify(msg.message, { timeout: 2500, error: msg.error });
      break;
    case 'open-url':
      if (/^https:\/\//.test(msg.url)) figma.openExternal(msg.url);
      break;
  }
};

figma.on('selectionchange', postSelection);
figma.on('currentpagechange', () => post({ type: 'page-changed', pageName: figma.currentPage.name }));

(async () => {
  settings = await loadSettings();
  uiSize = { ...settings.window };
  try {
    sweepPreviewClones();
  } catch {
    /* page non modifiable : rien à nettoyer */
  }
  figma.showUI(__html__, { width: settings.window.width, height: settings.window.height, themeColors: true });
})();
