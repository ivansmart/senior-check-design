/// <reference types="@figma/plugin-typings" />
import { resolveActiveRules } from '../shared/rules-catalog';
import { WINDOW_MAX_H, clampWindow, sanitizeSettings } from '../shared/settings';
import type { FixOutcome, Issue, PluginToUiMessage, Settings, UiToPluginMessage } from '../shared/types';
import { countVariables, toCss, toDtcg, toTailwind } from '../shared/tokens-export';
import { DEFAULT_SETTINGS } from '../shared/types';
import { buildTokenModel } from './export/tokens-model';
import { applyPlan, FixError, type UndoEntry } from './fix/apply';
import type { FixPlan } from './fix/plans';
import { MAX_PREVIEW_NODES, renderPreview, sweepPreviewClones, type PreviewItem } from './preview';
import { nodeDepth, sortForApply } from './reattach-live';
import { ALL_RULES } from './rules';
import { revealNodes } from './reveal';
import { runScan, type IssuePlans } from './scan/engine';

const SETTINGS_KEY = 'scd:settings:v1';
const IGNORED_KEY = 'scd:ignored';
/** Bornes de la fenêtre réelle : plus large avec le volet Comparer, plus basse une fois repliée. */
const MIN_TOTAL_W = 200;
const MIN_TOTAL_H = 40;
const MAX_TOTAL_W = 2200;
/** Attente maximale d'une correction ou d'un aperçu en cours avant de démarrer une analyse. */
const BUSY_WAIT_MS = 20000;

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
const clamp = (v: number, min: number, max: number) => (Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : min);
/** Une correction ou une annulation est en cours (les aperçus et les analyses attendent). */
let applying = false;

async function loadSettings(): Promise<Settings> {
  try {
    // Réglages d'une ancienne version ou corrompus : chaque champ retombe sur sa valeur par défaut.
    return sanitizeSettings(await figma.clientStorage.getAsync(SETTINGS_KEY));
  } catch {
    /* stockage indisponible : valeurs par défaut */
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(partial: Partial<Settings>) {
  settings = sanitizeSettings({
    ...settings,
    ...partial,
    options: { ...settings.options, ...(partial.options ?? {}) },
    window: partial.window ?? settings.window,
  });
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  } catch {
    /* ignore */
  }
}

/** Attend la fin d'une correction ou d'un aperçu en cours : une analyse qui viderait les plans pendant un lot le ferait échouer. */
async function waitUntilIdle(): Promise<void> {
  const started = Date.now();
  while ((applying || previewRunning) && Date.now() - started < BUSY_WAIT_MS) await new Promise((r) => setTimeout(r, 50));
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
    selectionIds: figma.currentPage.selection.slice(0, 50).map((n) => n.id),
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
  await waitUntilIdle();
  issues.clear();
  plans.clear();
  journals.clear();
  const activeRules = resolveActiveRules(msg.preset, msg.disabledRules, msg.enabledRules, msg.mode);
  const ignored = new Set(readIgnored());
  let lastProgressAt = 0;
  try {
    const out = await runScan(
      { scope: msg.scope, rootIds: msg.rootIds, options: msg.options, activeRules, ignoredIssueIds: ignored, rules: ALL_RULES },
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
  const programmatic = key !== '' && key === programmaticSelectionKey;
  // Dès que l'utilisateur sélectionne autre chose, la sélection posée par le plugin ne compte plus comme telle.
  if (!programmatic) programmaticSelectionKey = '';
  post({ type: 'selection', count: sel.length, ids: sel.slice(0, 50).map((n) => n.id), programmatic });
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
  const removedNodeIds = new Set<string>();
  figma.commitUndo();
  applying = true;
  let done = 0;
  // Ordre du lot : corrections de valeurs d'abord, puis rattachements du plus profond au moins profond.
  const infos = await Promise.all(
    entries.map(async (e) => {
      const plan = planFor(e.issueId, e.alternativeId);
      if (plan?.kind !== 'reattach-instance') return { reattach: false, depth: 0 };
      const node = await figma.getNodeByIdAsync(plan.nodeId);
      return { reattach: true, depth: node ? nodeDepth(node) : 0 };
    }),
  );
  const ordered = sortForApply(
    entries.map((e, i) => ({ e, info: infos[i] })),
    (x) => x.info,
  ).map((x) => x.e);
  for (const { issueId, alternativeId } of ordered) {
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
      for (const id of entry.removedNodeIds ?? []) removedNodeIds.add(id);
    } catch (e) {
      outcomes.push({ issueId, ok: false, reason: e instanceof FixError ? e.reason : 'unknown' });
    }
    done++;
    if (reportProgress && (done % 5 === 0 || done === entries.length)) post({ type: 'fix-progress', done, total: entries.length });
    if (done % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  applying = false;
  if (journal.length) journals.set(batchId, journal);
  // Les lignes des calques remplacés par une instance n'ont plus d'objet : l'interface les retire.
  for (const issue of issues.values()) if (issue.status === 'open' && removedNodeIds.has(issue.nodeId)) issue.status = 'fixed';
  post({ type: 'fix-done', batchId, outcomes, undoable: journal.length > 0, removedNodeIds: [...removedNodeIds] });
}

async function undoBatch(batchId: string) {
  const journal = journals.get(batchId);
  if (!journal) return;
  journals.delete(batchId);
  figma.commitUndo();
  applying = true;
  const restored: string[] = [];
  let needsRescan = false;
  for (const entry of [...journal].reverse()) {
    try {
      await entry.revert();
      const issue = issues.get(entry.issueId);
      if (issue) issue.status = 'open';
      restored.push(entry.issueId);
      // Un rattachement annulé rend un calque détaché neuf : les identifiants de l'analyse ne le désignent plus.
      if (entry.kind === 'reattach') needsRescan = true;
    } catch {
      /* le node a pu disparaître : on continue */
    }
  }
  applying = false;
  post({ type: 'undo-done', batchId, issueIds: restored, needsRescan });
}

/** Aperçus sérialisés : une demande à la fois, seule la plus récente en attente est conservée. */
async function handlePreview(msg: Extract<UiToPluginMessage, { type: 'preview' }>) {
  if (previewRunning) {
    previewPending = msg;
    return;
  }
  previewRunning = true;
  try {
    // Jamais pendant une analyse ou une correction : les deux se disputeraient le thread principal.
    if (scanning || applying) {
      post({ type: 'preview-done', requestId: msg.requestId, frames: [], skipped: msg.items.length, roots: [], tooBig: [], maxNodes: MAX_PREVIEW_NODES });
      return;
    }
    const items: PreviewItem[] = [];
    for (const { issueId, alternativeId } of msg.items) {
      const issue = issues.get(issueId);
      const plan = planFor(issueId, alternativeId);
      if (issue && plan && issue.status === 'open') items.push({ issueId, nodeId: issue.nodeId, plan });
    }
    const out = await renderPreview({ items, maxRoots: clamp(msg.maxRoots, 1, 4), rootId: msg.rootId ?? null, followSelection: msg.followSelection });
    post({ type: 'preview-done', requestId: msg.requestId, frames: out.frames, skipped: out.skipped, roots: out.roots, tooBig: out.tooBig, maxNodes: MAX_PREVIEW_NODES });
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
  // Une exception non interceptée ferait fermer le plugin par Figma avec un message d'erreur :
  // tout message est traité sous garde, et l'UI est prévenue plutôt que tuée.
  try {
    await dispatch(msg);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (msg.type === 'scan') {
      scanning = false;
      post({ type: 'scan-error', message, partial: null });
    } else {
      applying = false;
      figma.notify(`Senior Check Design : ${message}`, { error: true, timeout: 5000 });
    }
  }
};

async function dispatch(msg: UiToPluginMessage): Promise<void> {
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
      const total = { width: clamp(msg.width, MIN_TOTAL_W, MAX_TOTAL_W), height: clamp(msg.height, MIN_TOTAL_H, WINDOW_MAX_H) };
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
}

figma.on('selectionchange', postSelection);
figma.on('currentpagechange', () => {
  // La sélection connue de l'interface appartenait à l'ancienne page : on repart de celle de la nouvelle page.
  programmaticSelectionKey = '';
  post({ type: 'page-changed', pageName: figma.currentPage.name });
  postSelection();
});

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
