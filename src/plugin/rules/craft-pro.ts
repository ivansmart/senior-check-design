/// <reference types="@figma/plugin-typings" />
/** Craft & interaction (Pro) : destructif sans confirmation, erreur sans récupération, message générique, easing, durées, hover non réversible. */
import { CONFIRM_RE, DESTRUCTIVE_RE, ERROR_NAME_RE, GENERIC_ERROR_RE, RECOVERY_RE, canonicalState, inferComponentKind } from '../../shared/names';
import type { ComponentSetInfo, RawIssue } from '../scan/context';
import { ancestors, isInteractiveByReactions } from '../scan/node-info';
import { toMs, type Rule } from './types';

const ACTION_KINDS = new Set(['button', 'icon-button', 'link', 'chip']);
const FIELD_KINDS = new Set(['input', 'select', 'checkbox', 'radio', 'toggle', 'search', 'chip', 'tab']);
const MAX_TRANSITION_MS = 500;
const CAPPED_MS = 300;

function nodeActions(node: SceneNode): { trigger: string; action: Action; reaction: Reaction }[] {
  if (!('reactions' in node)) return [];
  const out: { trigger: string; action: Action; reaction: Reaction }[] = [];
  for (const r of (node as ReactionMixin).reactions) {
    const actions = r.actions ?? (r.action ? [r.action] : []);
    for (const a of actions) out.push({ trigger: r.trigger?.type ?? '', action: a, reaction: r });
  }
  return out;
}

export const craftProRules: Rule[] = [
  {
    id: 'craft/destructive-without-confirm',
    types: ['TEXT', 'FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'],
    insideInstances: true,
    check: (node, ctx) => {
      if (node.type !== 'TEXT') {
        if (CONFIRM_RE.test(node.name)) ctx.confirmPatternSeen = true;
        return;
      }
      const text = (node as TextNode).characters.trim();
      if (!text || text.length > 40 || !DESTRUCTIVE_RE.test(text)) return;
      const host = ancestors(node, ctx).find((a) => ACTION_KINDS.has(inferComponentKind(a.name)) || isInteractiveByReactions(a)) ?? node;
      if (!ctx.destructiveNodes.some((n) => n.id === host.id)) ctx.destructiveNodes.push(host);
    },
    finalize: (ctx) => {
      if (ctx.confirmPatternSeen) return;
      return ctx.destructiveNodes.map<RawIssue>((n) => ({ ruleId: 'craft/destructive-without-confirm', node: n, currentValue: n.name, fixSafety: 'none', params: { label: n.name } }));
    },
  },
  {
    id: 'craft/error-without-recovery',
    types: ['FRAME', 'COMPONENT', 'INSTANCE'],
    check: (node, ctx) => {
      const isVariantError = node.type === 'COMPONENT' && Object.values(node.variantProperties ?? {}).some((v) => canonicalState(v) === 'error');
      if (!isVariantError && !ERROR_NAME_RE.test(node.name)) return;
      if (ancestors(node, ctx).some((a) => ERROR_NAME_RE.test(a.name))) return; // déjà couvert par un parent
      if (node.width < 200 || node.height < 120) return; // un champ en erreur n'est pas un écran d'erreur
      const kind = inferComponentKind(node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET' ? node.parent.name : node.name);
      if (FIELD_KINDS.has(kind)) return;
      const host = node as FrameNode;
      const texts = host.findAllWithCriteria({ types: ['TEXT'] });
      if (!texts.length) return;
      const recovery =
        texts.some((t) => RECOVERY_RE.test(t.characters)) ||
        host.findAllWithCriteria({ types: ['INSTANCE', 'FRAME', 'COMPONENT'] }).some((c) => ACTION_KINDS.has(inferComponentKind(c.name)) || isInteractiveByReactions(c));
      if (recovery) return;
      return [{ ruleId: 'craft/error-without-recovery', node, currentValue: node.name, fixSafety: 'none', params: { name: node.name } }];
    },
  },
  {
    id: 'craft/generic-error-message',
    types: ['TEXT'],
    insideInstances: true,
    check: (node) => {
      const text = (node as TextNode).characters.trim();
      if (!text || !GENERIC_ERROR_RE.test(text)) return;
      return [{ ruleId: 'craft/generic-error-message', node, currentValue: text, fixSafety: 'none', params: { text } }];
    },
  },
  {
    id: 'craft/inconsistent-easing',
    finalize: (ctx) => {
      const out: RawIssue[] = [];
      const byKind = new Map<string, { set: ComponentSetInfo; nodeId: string; easing: string }[]>();
      for (const s of ctx.componentSets) {
        for (const h of s.hoverDurations) {
          const key = s.kind === 'unknown' ? `unknown:${s.name}` : s.kind;
          byKind.set(key, [...(byKind.get(key) ?? []), { set: s, nodeId: h.nodeId, easing: h.easing }]);
        }
      }
      for (const [kind, list] of byKind) {
        const counts = new Map<string, number>();
        for (const l of list) counts.set(l.easing, (counts.get(l.easing) ?? 0) + 1);
        if (counts.size < 2) continue;
        const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
        for (const l of list) {
          if (l.easing === mode) continue;
          const variant = l.set.node.children.find((c) => c.id === l.nodeId) ?? l.set.node;
          out.push({
            ruleId: 'craft/inconsistent-easing',
            node: variant,
            currentValue: l.easing,
            suggestion: { kind: 'value', id: mode, label: mode, confidence: 'close' },
            fixSafety: 'review',
            params: { easing: l.easing, mode, kind: kind.replace(/^unknown:/, ''), component: l.set.name },
            plan: { kind: 'set-hover-easing', nodeId: l.nodeId, easing: mode },
          });
        }
      }
      return out;
    },
  },
  {
    id: 'craft/transition-too-long',
    types: ['COMPONENT', 'FRAME', 'INSTANCE'],
    check: (node) => {
      let max = 0;
      for (const { action } of nodeActions(node)) {
        if (action.type !== 'NODE' || !action.transition || !('duration' in action.transition)) continue;
        max = Math.max(max, toMs(action.transition.duration));
      }
      if (max <= MAX_TRANSITION_MS) return;
      return [
        {
          ruleId: 'craft/transition-too-long',
          node,
          currentValue: `${max} ms`,
          suggestion: { kind: 'value', id: String(CAPPED_MS), label: `≤ ${CAPPED_MS} ms`, confidence: 'close' },
          fixSafety: 'review',
          params: { duration: max, max: MAX_TRANSITION_MS, capped: CAPPED_MS },
          plan: { kind: 'cap-transition-duration', nodeId: node.id, maxMs: CAPPED_MS },
        },
      ];
    },
  },
  {
    id: 'craft/non-reversible-hover',
    types: ['COMPONENT'],
    check: (node) => {
      const set = node.parent;
      if (!set || set.type !== 'COMPONENT_SET') return;
      const out: RawIssue[] = [];
      for (const { trigger, action } of nodeActions(node)) {
        if (trigger !== 'MOUSE_ENTER' || action.type !== 'NODE' || action.navigation !== 'CHANGE_TO' || !action.destinationId) continue;
        const destination = set.children.find((c) => c.id === action.destinationId);
        if (!destination || !('reactions' in destination)) continue;
        const back = (destination as ComponentNode).reactions.some((r) => r.trigger?.type === 'MOUSE_LEAVE');
        if (back) continue;
        out.push({
          ruleId: 'craft/non-reversible-hover',
          node,
          slot: destination.id,
          currentValue: `${node.name} → ${destination.name}`,
          fixSafety: 'none',
          params: { component: set.name, from: node.name, to: destination.name },
        });
      }
      return out;
    },
  },
];
