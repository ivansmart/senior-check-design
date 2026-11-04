/// <reference types="@figma/plugin-typings" />
import type { FixPlan } from './plans';

/** Entrée du journal d'annulation : une closure qui restaure l'état exact d'avant. */
export interface UndoEntry {
  issueId: string;
  revert: () => Promise<void>;
}

export class FixError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

type PaintHost = SceneNode & MinimalFillsMixin & MinimalStrokesMixin;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

async function getNode(id: string): Promise<SceneNode> {
  const node = await figma.getNodeByIdAsync(id);
  if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') throw new FixError('node-missing');
  if ((node as SceneNode).removed) throw new FixError('node-missing');
  return node as SceneNode;
}

async function getVariable(id: string): Promise<Variable> {
  const v = await figma.variables.getVariableByIdAsync(id);
  if (!v) throw new FixError('variable-missing');
  return v;
}

function getPaints(node: SceneNode, prop: 'fills' | 'strokes'): readonly Paint[] {
  const value = (node as PaintHost)[prop];
  if (!value || value === figma.mixed) throw new FixError('mixed-paints');
  return value as readonly Paint[];
}

async function loadFontsFor(node: TextNode): Promise<void> {
  const fontName = node.fontName;
  if (fontName === figma.mixed) {
    const fonts = node.getRangeAllFontNames(0, node.characters.length);
    await Promise.all(fonts.map((f) => figma.loadFontAsync(f)));
  } else {
    await figma.loadFontAsync(fontName);
  }
}

/** Applique un plan et retourne l'opération inverse. */
export async function applyPlan(issueId: string, plan: FixPlan): Promise<UndoEntry> {
  switch (plan.kind) {
    case 'bind-paint-variable': {
      const node = await getNode(plan.nodeId);
      const variable = await getVariable(plan.variableId);
      const before = clone(getPaints(node, plan.prop)) as Paint[];
      const paints = clone(before) as Paint[];
      const target = paints[plan.index];
      if (!target || target.type !== 'SOLID') throw new FixError('paint-changed');
      paints[plan.index] = figma.variables.setBoundVariableForPaint(target, 'color', variable);
      (node as PaintHost)[plan.prop] = paints;
      return {
        issueId,
        revert: async () => {
          const n = await getNode(plan.nodeId);
          (n as PaintHost)[plan.prop] = before;
        },
      };
    }
    case 'apply-paint-style': {
      const node = await getNode(plan.nodeId) as PaintHost;
      const before = clone(getPaints(node, plan.prop)) as Paint[];
      const beforeStyle = plan.prop === 'fills' ? node.fillStyleId : node.strokeStyleId;
      if (beforeStyle === figma.mixed) throw new FixError('mixed-paints');
      if (plan.prop === 'fills') await node.setFillStyleIdAsync(plan.styleId);
      else await node.setStrokeStyleIdAsync(plan.styleId);
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as PaintHost;
          if (plan.prop === 'fills') {
            await n.setFillStyleIdAsync(beforeStyle as string);
            if (!beforeStyle) n.fills = before;
          } else {
            await n.setStrokeStyleIdAsync(beforeStyle as string);
            if (!beforeStyle) n.strokes = before;
          }
        },
      };
    }
    case 'apply-text-style': {
      const node = (await getNode(plan.nodeId)) as TextNode;
      if (node.type !== 'TEXT') throw new FixError('node-type');
      const style = await figma.getStyleByIdAsync(plan.styleId);
      if (!style || style.type !== 'TEXT') throw new FixError('style-missing');
      if (node.fontName === figma.mixed || node.fontSize === figma.mixed) throw new FixError('mixed-text');
      const before = {
        textStyleId: node.textStyleId as string,
        fontName: node.fontName as FontName,
        fontSize: node.fontSize as number,
        lineHeight: node.lineHeight as LineHeight,
        letterSpacing: node.letterSpacing as LetterSpacing,
        textDecoration: node.textDecoration as TextDecoration,
        textCase: node.textCase as TextCase,
      };
      await Promise.all([loadFontsFor(node), figma.loadFontAsync(style.fontName)]);
      await node.setTextStyleIdAsync(plan.styleId);
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as TextNode;
          await Promise.all([loadFontsFor(n), figma.loadFontAsync(before.fontName)]);
          await n.setTextStyleIdAsync(before.textStyleId);
          if (!before.textStyleId) {
            n.fontName = before.fontName;
            n.fontSize = before.fontSize;
            n.lineHeight = before.lineHeight;
            n.letterSpacing = before.letterSpacing;
            n.textDecoration = before.textDecoration;
            n.textCase = before.textCase;
          }
        },
      };
    }
    case 'bind-number': {
      const node = await getNode(plan.nodeId);
      const variable = await getVariable(plan.variableId);
      const host = node as unknown as Record<string, unknown> & SceneNodeMixin;
      const before = plan.fields.map((f) => ({ field: f, value: host[f] as number }));
      for (const f of plan.fields) node.setBoundVariable(f, variable);
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as unknown as Record<string, unknown> & SceneNodeMixin;
          for (const { field, value } of before) {
            n.setBoundVariable(field, null);
            if (typeof value === 'number') (n as Record<string, unknown>)[field] = value;
          }
        },
      };
    }
    case 'round-size': {
      const node = await getNode(plan.nodeId);
      if (!('resizeWithoutConstraints' in node)) throw new FixError('node-type');
      const before = { w: node.width, h: node.height };
      const w = Math.max(0.01, Math.round(node.width));
      const h = Math.max(0.01, Math.round(node.height));
      (node as LayoutMixin).resizeWithoutConstraints(w, h);
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as LayoutMixin & SceneNode;
          n.resizeWithoutConstraints(before.w, before.h);
        },
      };
    }
    case 'round-position': {
      const node = await getNode(plan.nodeId) as LayoutMixin & SceneNode;
      const before = { x: node.x, y: node.y };
      node.x = Math.round(node.x);
      node.y = Math.round(node.y);
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as LayoutMixin & SceneNode;
          n.x = before.x;
          n.y = before.y;
        },
      };
    }
    case 'set-hover-duration': {
      const node = await getNode(plan.nodeId) as SceneNode & ReactionMixin;
      if (!('reactions' in node)) throw new FixError('node-type');
      const before = clone(node.reactions) as Reaction[];
      const next = clone(before) as Reaction[];
      let touched = false;
      for (const r of next) {
        const t = r.trigger?.type;
        if (t !== 'ON_HOVER' && t !== 'MOUSE_ENTER') continue;
        const actions = (r.actions ?? (r.action ? [r.action] : [])) as Action[];
        for (const a of actions) {
          if (a.type === 'NODE' && a.transition && 'duration' in a.transition) {
            // L'API expose la durée en secondes (ex. 0.3) ; on reste dans l'unité observée par sécurité.
            const current = a.transition.duration;
            const inSeconds = current < 10;
            (a.transition as { duration: number }).duration = inSeconds ? plan.durationMs / 1000 : plan.durationMs;
            touched = true;
          }
        }
        if (r.actions) (r as { actions: Action[] }).actions = actions;
        else if (r.action) (r as { action: Action }).action = actions[0];
      }
      if (!touched) throw new FixError('no-transition');
      await node.setReactionsAsync(next);
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as SceneNode & ReactionMixin;
          await n.setReactionsAsync(before);
        },
      };
    }
    // ---- Pro ------------------------------------------------------------
    case 'set-number': {
      const node = (await getNode(plan.nodeId)) as unknown as Record<string, unknown> & SceneNode;
      if (!(plan.field in node) || typeof node[plan.field] !== 'number') throw new FixError('node-type');
      const before = node[plan.field] as number;
      node[plan.field] = plan.value;
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as unknown as Record<string, unknown>;
          n[plan.field] = before;
        },
      };
    }
    case 'set-line-height': {
      const node = (await getNode(plan.nodeId)) as TextNode;
      if (node.type !== 'TEXT') throw new FixError('node-type');
      if (node.lineHeight === figma.mixed) throw new FixError('mixed-text');
      const before = node.lineHeight as LineHeight;
      await loadFontsFor(node);
      node.lineHeight = { unit: 'PIXELS', value: plan.px };
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as TextNode;
          await loadFontsFor(n);
          n.lineHeight = before;
        },
      };
    }
    case 'set-layout-sizing': {
      const node = await getNode(plan.nodeId);
      if (!('layoutSizingHorizontal' in node)) throw new FixError('node-type');
      const host = node as SceneNode & AutoLayoutChildrenMixin & LayoutMixin;
      const before = plan.axis === 'horizontal' ? host.layoutSizingHorizontal : host.layoutSizingVertical;
      const size = { w: host.width, h: host.height };
      if (plan.axis === 'horizontal') host.layoutSizingHorizontal = plan.value;
      else host.layoutSizingVertical = plan.value;
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as SceneNode & AutoLayoutChildrenMixin & LayoutMixin;
          if (plan.axis === 'horizontal') n.layoutSizingHorizontal = before;
          else n.layoutSizingVertical = before;
          if (before === 'FIXED' && 'resize' in n) n.resize(size.w, size.h);
        },
      };
    }
    case 'set-axis-sizing': {
      const node = await getNode(plan.nodeId);
      if (!('primaryAxisSizingMode' in node)) throw new FixError('node-type');
      const host = node as BaseFrameMixin & SceneNode;
      const before = plan.axis === 'primary' ? host.primaryAxisSizingMode : host.counterAxisSizingMode;
      const size = { w: host.width, h: host.height };
      if (plan.axis === 'primary') host.primaryAxisSizingMode = plan.value;
      else host.counterAxisSizingMode = plan.value;
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as BaseFrameMixin & SceneNode;
          if (plan.axis === 'primary') n.primaryAxisSizingMode = before;
          else n.counterAxisSizingMode = before;
          if (before === 'FIXED') n.resize(size.w, size.h);
        },
      };
    }
    case 'set-hover-easing':
    case 'cap-transition-duration': {
      const node = (await getNode(plan.nodeId)) as SceneNode & ReactionMixin;
      if (!('reactions' in node)) throw new FixError('node-type');
      const before = clone(node.reactions) as Reaction[];
      const next = clone(before) as Reaction[];
      let touched = false;
      for (const r of next) {
        const t = r.trigger?.type;
        const hoverOnly = plan.kind === 'set-hover-easing';
        if (hoverOnly && t !== 'ON_HOVER' && t !== 'MOUSE_ENTER') continue;
        const actions = (r.actions ?? (r.action ? [r.action] : [])) as Action[];
        for (const a of actions) {
          if (a.type !== 'NODE' || !a.transition || !('duration' in a.transition)) continue;
          const tr = a.transition as { duration: number; easing: Easing };
          if (plan.kind === 'set-hover-easing') {
            tr.easing = { type: plan.easing as Easing['type'] } as Easing;
            touched = true;
          } else {
            const inSeconds = tr.duration < 10;
            const ms = inSeconds ? tr.duration * 1000 : tr.duration;
            if (ms > plan.maxMs) {
              tr.duration = inSeconds ? plan.maxMs / 1000 : plan.maxMs;
              touched = true;
            }
          }
        }
        if (r.actions) (r as { actions: Action[] }).actions = actions;
        else if (r.action) (r as { action: Action }).action = actions[0];
      }
      if (!touched) throw new FixError('no-transition');
      await node.setReactionsAsync(next);
      return {
        issueId,
        revert: async () => {
          const n = (await getNode(plan.nodeId)) as SceneNode & ReactionMixin;
          await n.setReactionsAsync(before);
        },
      };
    }
  }
}
