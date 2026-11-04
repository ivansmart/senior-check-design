/// <reference types="@figma/plugin-typings" />
/** Accessibilité (Pro) : hiérarchie de titres, contraste des icônes et bordures, icône sans libellé, information par la couleur seule. */
import { contrastRatio, formatRatio, rgbToHex } from '../../shared/color';
import { ICON_NAME_RE, headingLevel, inferComponentKind, isDefaultName } from '../../shared/names';
import type { RawIssue, ScanContext } from '../scan/context';
import { ancestors, backgroundBehind, isInteractiveByReactions, resolveSolidPaint } from '../scan/node-info';
import type { Rule } from './types';

const INTERACTIVE_KINDS = new Set(['button', 'icon-button', 'link', 'checkbox', 'radio', 'toggle', 'chip', 'tab', 'select']);
const FIELD_KINDS = new Set(['input', 'select', 'checkbox', 'radio', 'toggle', 'search']);
const NON_TEXT_MIN = 3;
const STATUS_TOKEN_RE = /(error|danger|success|warning|invalid|negative|positive|critical)/i;
const GENERIC_ICON_BUTTON_RE = /^(icon[\s_-]?(button|btn)|button|btn|icon|action)$/i;

const singleSolid = (paints: readonly Paint[] | typeof figma.mixed): SolidPaint | null => {
  if (paints === figma.mixed) return null;
  const visible = paints.filter((p) => p.visible !== false && (p.opacity ?? 1) > 0);
  return visible.length === 1 && visible[0].type === 'SOLID' ? visible[0] : null;
};

async function kindOfNode(node: SceneNode): Promise<string> {
  if (node.type === 'INSTANCE') {
    try {
      const main = await node.getMainComponentAsync();
      if (main) {
        const set = main.parent?.type === 'COMPONENT_SET' ? main.parent : null;
        return inferComponentKind(set ? set.name : main.name, (set ?? main).description);
      }
    } catch {
      /* composant inaccessible */
    }
  }
  return inferComponentKind(node.name, 'description' in node ? (node as ComponentNode).description : '');
}

function inInteractiveContext(node: SceneNode, ctx: ScanContext): boolean {
  return ancestors(node, ctx).some((a) => INTERACTIVE_KINDS.has(inferComponentKind(a.name)) || isInteractiveByReactions(a));
}

export const a11yProRules: Rule[] = [
  {
    id: 'a11y/heading-skip',
    types: ['TEXT'],
    check: (node, ctx) => {
      const text = node as TextNode;
      if (typeof text.textStyleId !== 'string' || !text.textStyleId) return;
      const style = ctx.textStyles.find((s) => s.id === text.textStyleId);
      if (!style) return;
      const level = headingLevel(style.name);
      if (!level) return;
      const chain = ancestors(text, ctx);
      const root = chain[chain.length - 1] ?? text;
      ctx.headings.push({ node: text, level, rootId: root.id, y: text.absoluteBoundingBox?.y ?? text.y });
    },
    finalize: (ctx) => {
      const byRoot = new Map<string, ScanContext['headings']>();
      for (const h of ctx.headings) byRoot.set(h.rootId, [...(byRoot.get(h.rootId) ?? []), h]);
      const out: RawIssue[] = [];
      for (const list of byRoot.values()) {
        if (list.length < 2) continue;
        list.sort((a, b) => a.y - b.y);
        let prev = list[0].level;
        for (const h of list.slice(1)) {
          if (h.level > prev + 1) {
            out.push({ ruleId: 'a11y/heading-skip', node: h.node, currentValue: `H${prev} → H${h.level}`, fixSafety: 'none', params: { level: h.level, prev, expected: prev + 1 } });
          }
          prev = h.level;
        }
      }
      return out;
    },
  },
  {
    id: 'a11y/icon-contrast',
    types: ['VECTOR', 'BOOLEAN_OPERATION'],
    insideInstances: true,
    check: async (node, ctx) => {
      if (node.width < 8 || node.height < 8) return;
      const iconish = ICON_NAME_RE.test(node.name) || ancestors(node, ctx).slice(0, 2).some((a) => ICON_NAME_RE.test(a.name));
      if (!iconish && !inInteractiveContext(node, ctx)) return;
      const paint = singleSolid((node as GeometryMixin).fills);
      if (!paint) return;
      const bg = await backgroundBehind(node, ctx);
      if (bg.kind !== 'solid') return;
      const fg = await resolveSolidPaint(paint, node);
      if (fg.alpha < 0.99) return;
      const ratio = contrastRatio(fg.rgb, bg.rgb);
      if (ratio >= NON_TEXT_MIN) return;
      return [
        {
          ruleId: 'a11y/icon-contrast',
          node,
          currentValue: formatRatio(ratio),
          swatch: rgbToHex(fg.rgb),
          fixSafety: 'none',
          params: { ratio: formatRatio(ratio), required: '3:1', fg: rgbToHex(fg.rgb), bg: rgbToHex(bg.rgb) },
        },
      ];
    },
  },
  {
    id: 'a11y/border-contrast',
    types: ['FRAME', 'INSTANCE', 'COMPONENT', 'RECTANGLE'],
    check: async (node, ctx) => {
      const kind = await kindOfNode(node);
      if (!FIELD_KINDS.has(kind)) return;
      const host = node as GeometryMixin & SceneNode;
      const weight = typeof host.strokeWeight === 'number' ? host.strokeWeight : 1;
      if (weight < 1) return;
      const paint = singleSolid(host.strokes);
      if (!paint) return;
      const bg = await backgroundBehind(node, ctx);
      if (bg.kind !== 'solid') return;
      const stroke = await resolveSolidPaint(paint, node);
      if (stroke.alpha < 0.99) return;
      const ratio = contrastRatio(stroke.rgb, bg.rgb);
      if (ratio >= NON_TEXT_MIN) return;
      return [
        {
          ruleId: 'a11y/border-contrast',
          node,
          currentValue: formatRatio(ratio),
          swatch: rgbToHex(stroke.rgb),
          fixSafety: 'none',
          params: { ratio: formatRatio(ratio), required: '3:1', stroke: rgbToHex(stroke.rgb), bg: rgbToHex(bg.rgb), kind },
        },
      ];
    },
  },
  {
    id: 'a11y/icon-only-without-label',
    types: ['INSTANCE', 'FRAME', 'COMPONENT'],
    check: async (node) => {
      if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') return;
      const kind = await kindOfNode(node);
      const interactive = kind === 'icon-button' || isInteractiveByReactions(node) || (kind === 'button' && node.width <= 64);
      if (!interactive) return;
      const host = node as FrameNode;
      const texts = host.findAllWithCriteria({ types: ['TEXT'] }).filter((t) => t.characters.trim());
      if (texts.length) return;
      const glyphs = host.findAllWithCriteria({ types: ['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'RECTANGLE', 'INSTANCE'] });
      if (!glyphs.length) return;
      const name = node.name.replace(/.*\//, '').trim(); // « Icon button / Close » → « Close »
      if (!isDefaultName(node.name) && !GENERIC_ICON_BUTTON_RE.test(name) && name.length > 2) return;
      return [{ ruleId: 'a11y/icon-only-without-label', node, currentValue: node.name, fixSafety: 'none', params: { name: node.name } }];
    },
  },
  {
    id: 'a11y/color-only-status',
    types: ['TEXT'],
    insideInstances: true,
    check: (node, ctx) => {
      const text = node as TextNode;
      const paint = singleSolid(text.fills);
      const id = paint?.boundVariables?.color?.id;
      if (!id) return;
      const token = ctx.colorById.get(id);
      if (!token || !STATUS_TOKEN_RE.test(token.name)) return;
      const parent = text.parent;
      if (!parent || !('children' in parent)) return;
      const hasIcon = (parent as ChildrenMixin).children.some((c) => c.id !== text.id && (ICON_NAME_RE.test(c.name) || c.type === 'VECTOR' || c.type === 'BOOLEAN_OPERATION'));
      if (hasIcon) return;
      return [{ ruleId: 'a11y/color-only-status', node, currentValue: token.name, swatch: rgbToHex(token.rgb), fixSafety: 'none', params: { token: token.name } }];
    },
  },
];
