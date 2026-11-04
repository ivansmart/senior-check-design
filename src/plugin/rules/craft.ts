/// <reference types="@figma/plugin-typings" />
import {
  EMPTY_STATE_KINDS,
  EXPECTED_STATES,
  canonicalState,
  inferComponentKind,
  isStateProperty,
  looksLikeLongAction,
  normalizeStateValue,
} from '../../shared/names';
import type { ComponentSetInfo, RawIssue, ScanContext } from '../scan/context';
import { toMs, type Rule } from './types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Extrait les états canoniques d'un component set (variantes + propriétés booléennes/variantes nommées). */
function collectStates(set: ComponentSetNode): { stateProp: string | null; stateValues: string[]; canonical: Set<string> } {
  const defs = set.componentPropertyDefinitions;
  const canonical = new Set<string>();
  let stateProp: string | null = null;
  let stateValues: string[] = [];
  for (const [name, def] of Object.entries(defs)) {
    const options = def.variantOptions ?? [];
    if (def.type === 'VARIANT' && !stateProp && isStateProperty(name, options)) {
      stateProp = name;
      stateValues = options;
      for (const v of options) {
        const c = canonicalState(v);
        if (c) canonical.add(c);
      }
      continue;
    }
    // "Checked=True/False", "Disabled=Yes/No", booléen "Loading"
    const c = canonicalState(name);
    if (c && (def.type === 'BOOLEAN' || def.type === 'VARIANT')) canonical.add(c);
  }
  return { stateProp, stateValues, canonical };
}

function hoverTransitions(set: ComponentSetNode): { nodeId: string; duration: number; easing: string }[] {
  const out: { nodeId: string; duration: number; easing: string }[] = [];
  for (const child of set.children) {
    if (!('reactions' in child)) continue;
    for (const r of (child as ComponentNode).reactions) {
      const t = r.trigger?.type;
      if (t !== 'ON_HOVER' && t !== 'MOUSE_ENTER') continue;
      const actions = r.actions ?? (r.action ? [r.action] : []);
      for (const a of actions) {
        if (a.type === 'NODE' && a.navigation === 'CHANGE_TO' && a.transition && 'duration' in a.transition) {
          out.push({ nodeId: child.id, duration: toMs(a.transition.duration), easing: a.transition.easing.type });
        }
      }
    }
  }
  return out;
}

function defaultVariantsHaveHover(set: ComponentSetNode, stateProp: string): boolean | null {
  const defaults = set.children.filter((c) => {
    if (c.type !== 'COMPONENT') return false;
    const v = c.variantProperties?.[stateProp];
    return v !== undefined && canonicalState(v) === 'default';
  }) as ComponentNode[];
  if (!defaults.length) return null;
  return defaults.some((d) =>
    d.reactions.some((r) => {
      const t = r.trigger?.type;
      return t === 'ON_HOVER' || t === 'MOUSE_ENTER';
    }),
  );
}

function textsInside(set: ComponentSetNode): string {
  const first = set.children[0];
  if (!first || !('findAllWithCriteria' in first)) return '';
  const texts = (first as ComponentNode).findAllWithCriteria({ types: ['TEXT'] }).slice(0, 6);
  return texts.map((t) => t.characters).join(' ');
}

export const craftRules: Rule[] = [
  {
    id: 'craft/missing-state',
    types: ['COMPONENT_SET'],
    check: (node, ctx) => {
      const set = node as ComponentSetNode;
      const { stateProp, stateValues, canonical } = collectStates(set);
      const kind = inferComponentKind(set.name, set.description);
      const transitions = hoverTransitions(set);
      if (transitions.length) ctx.anySetHasReactions = true;
      const info: ComponentSetInfo = { node: set, name: set.name, kind, stateProp, stateValues, hoverDurations: transitions };
      ctx.componentSets.push(info);

      const out: RawIssue[] = [];
      if (!stateProp) return out; // pas de notion d'état : on ne juge pas
      const expected = EXPECTED_STATES[kind];
      if (expected) {
        for (const e of expected) {
          if (canonical.has(e.state)) continue;
          out.push({
            ruleId: 'craft/missing-state',
            node,
            slot: e.state,
            severity: e.severity,
            currentValue: stateValues.join(' · '),
            suggestion: { kind: 'value', id: e.state, label: `${stateProp}=${capitalize(e.state)}`, confidence: 'none' },
            fixSafety: 'none',
            params: { state: e.state, kind, component: set.name, prop: stateProp },
          });
        }
      }
      if (ctx.activeRules.has('craft/missing-loading-state') && (kind === 'button' || kind === 'icon-button') && !canonical.has('loading')) {
        if (looksLikeLongAction(set.name) || looksLikeLongAction(set.description) || looksLikeLongAction(textsInside(set))) {
          out.push({
            ruleId: 'craft/missing-loading-state',
            node,
            currentValue: stateValues.join(' · '),
            suggestion: { kind: 'value', id: 'loading', label: `${stateProp}=Loading`, confidence: 'none' },
            fixSafety: 'none',
            params: { component: set.name, prop: stateProp },
          });
        }
      }
      // ---- Pro : états en double, matrice réduite, feedback de succès ----
      if (ctx.activeRules.has('craft/duplicate-state')) {
        const byCanon = new Map<string, string[]>();
        for (const v of stateValues) {
          const c = canonicalState(v);
          if (c) byCanon.set(c, [...(byCanon.get(c) ?? []), v]);
        }
        for (const [c, values] of byCanon) {
          if (values.length < 2) continue;
          out.push({
            ruleId: 'craft/duplicate-state',
            node,
            slot: c,
            currentValue: values.join(' · '),
            fixSafety: 'none',
            params: { state: c, values: values.join(', '), component: set.name, prop: stateProp },
          });
        }
      }
      if (ctx.activeRules.has('craft/state-matrix-thin') && expected && canonical.size < 3) {
        out.push({
          ruleId: 'craft/state-matrix-thin',
          node,
          currentValue: stateValues.join(' · '),
          fixSafety: 'none',
          params: { count: canonical.size, component: set.name, kind, prop: stateProp },
        });
      }
      if (ctx.activeRules.has('craft/missing-success-state') && (kind === 'button' || kind === 'icon-button') && !canonical.has('success')) {
        if (looksLikeLongAction(set.name) || looksLikeLongAction(textsInside(set))) {
          out.push({
            ruleId: 'craft/missing-success-state',
            node,
            currentValue: stateValues.join(' · '),
            suggestion: { kind: 'value', id: 'success', label: `${stateProp}=Success`, confidence: 'none' },
            fixSafety: 'none',
            params: { component: set.name, prop: stateProp },
          });
        }
      }
      if (ctx.activeRules.has('craft/missing-empty-state') && EMPTY_STATE_KINDS.includes(kind) && !canonical.has('empty')) {
        out.push({
          ruleId: 'craft/missing-empty-state',
          node,
          currentValue: stateValues.join(' · '),
          suggestion: { kind: 'value', id: 'empty', label: `${stateProp}=Empty`, confidence: 'none' },
          fixSafety: 'none',
          params: { component: set.name, kind, prop: stateProp },
        });
      }
      return out;
    },
  },
  // Les règles ci-dessous partagent la collecte de craft/missing-state ; leur `check` est vide.
  { id: 'craft/missing-loading-state', types: ['COMPONENT_SET'] },
  { id: 'craft/missing-empty-state', types: ['COMPONENT_SET'] },
  { id: 'craft/missing-success-state', types: ['COMPONENT_SET'] },
  { id: 'craft/duplicate-state', types: ['COMPONENT_SET'] },
  { id: 'craft/state-matrix-thin', types: ['COMPONENT_SET'] },
  {
    id: 'craft/missing-hover-transition',
    types: ['COMPONENT_SET'],
    finalize: (ctx) => {
      if (!ctx.anySetHasReactions) return; // le fichier n'utilise pas les composants interactifs
      const out: RawIssue[] = [];
      for (const s of ctx.componentSets) {
        if (!s.stateProp) continue;
        const canon = new Set(s.stateValues.map((v) => canonicalState(v)));
        if (!canon.has('hover') || !canon.has('default')) continue;
        const has = defaultVariantsHaveHover(s.node, s.stateProp);
        if (has === false) {
          out.push({
            ruleId: 'craft/missing-hover-transition',
            node: s.node,
            currentValue: s.name,
            fixSafety: 'none',
            params: { component: s.name },
          });
        }
      }
      return out;
    },
  },
  {
    id: 'craft/state-naming',
    types: ['COMPONENT_SET'],
    finalize: (ctx) => {
      const sets = ctx.componentSets.filter((s) => s.stateProp);
      if (sets.length < 2) return;
      const out: RawIssue[] = [];
      // 1) Nom de la propriété : "State" vs "state" vs "Status".
      const propCounts = new Map<string, number>();
      for (const s of sets) propCounts.set(s.stateProp!, (propCounts.get(s.stateProp!) ?? 0) + 1);
      const majorityProp = [...propCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      // 2) Orthographe des valeurs par état canonique.
      const spelling = new Map<string, Map<string, number>>();
      for (const s of sets) {
        for (const v of s.stateValues) {
          const c = canonicalState(v);
          if (!c) continue;
          const m = spelling.get(c) ?? new Map<string, number>();
          m.set(v, (m.get(v) ?? 0) + 1);
          spelling.set(c, m);
        }
      }
      const majoritySpelling = new Map<string, string>();
      for (const [c, m] of spelling) majoritySpelling.set(c, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);

      for (const s of sets) {
        const problems: string[] = [];
        if (s.stateProp !== majorityProp && propCounts.size > 1) problems.push(`${s.stateProp} → ${majorityProp}`);
        for (const v of s.stateValues) {
          const c = canonicalState(v);
          if (!c) continue;
          const expected = majoritySpelling.get(c)!;
          if (expected !== v && normalizeStateValue(expected) !== normalizeStateValue(v) + '!') problems.push(`${v} → ${expected}`);
        }
        const unique = [...new Set(problems)].filter((p) => p.split(' → ')[0] !== p.split(' → ')[1]);
        if (!unique.length) continue;
        out.push({
          ruleId: 'craft/state-naming',
          node: s.node,
          currentValue: unique.join(', '),
          fixSafety: 'none',
          params: { component: s.name, changes: unique.join(', ') },
        });
      }
      return out;
    },
  },
  {
    id: 'craft/inconsistent-motion',
    types: ['COMPONENT_SET'],
    finalize: (ctx) => {
      const out: RawIssue[] = [];
      // Regroupe par genre de composant.
      const byKind = new Map<string, { set: ComponentSetInfo; nodeId: string; duration: number }[]>();
      for (const s of ctx.componentSets) {
        for (const h of s.hoverDurations) {
          const key = s.kind === 'unknown' ? `unknown:${s.name}` : s.kind;
          byKind.set(key, [...(byKind.get(key) ?? []), { set: s, nodeId: h.nodeId, duration: h.duration }]);
        }
      }
      for (const [kind, list] of byKind) {
        const counts = new Map<number, number>();
        for (const l of list) counts.set(l.duration, (counts.get(l.duration) ?? 0) + 1);
        if (counts.size < 2) continue;
        const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
        for (const l of list) {
          if (l.duration === mode) continue;
          const variant = l.set.node.children.find((c) => c.id === l.nodeId) ?? l.set.node;
          out.push({
            ruleId: 'craft/inconsistent-motion',
            node: variant,
            currentValue: `${l.duration} ms`,
            suggestion: { kind: 'value', id: String(mode), label: `${mode} ms`, confidence: 'close' },
            fixSafety: 'review',
            params: { duration: l.duration, mode, kind: kind.replace(/^unknown:/, ''), component: l.set.name },
            plan: { kind: 'set-hover-duration', nodeId: l.nodeId, durationMs: mode },
          });
        }
      }
      return out;
    },
  },
];
