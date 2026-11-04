/// <reference types="@figma/plugin-typings" />
/**
 * Composants recréés à la main (Pro) : un cadre qui ressemble visuellement à un composant
 * local sans en être une instance, même sans trace de détachement, avec des noms et une
 * structure différents. La ressemblance est estimée sur les propriétés (shared/lookalike),
 * le remplacement réutilise le rattachement « rendu conservé » (consentement requis).
 */
import { rgbToHex } from '../../shared/color';
import { bestLookalike, nameOverlap, type LookalikeCandidate, type VisualSig } from '../../shared/lookalike';
import { matchTrees, summarizeOverrides } from '../../shared/reattach';
import { MAX_FORCED_EXTRAS, newBudget, reasonDetail, reattachPlan, toTree, variantLabel } from '../reattach-live';
import { addComponent, buildComponentIndex, familyOf, noteInstance } from '../scan/component-index';
import { yieldToHost, type RawIssue, type ScanContext } from '../scan/context';
import { ancestors } from '../scan/node-info';
import type { Rule } from './types';

const RULE_ID = 'components/lookalike-frame';
/** Bornes : nombre de cadres candidats, de calques lus par signature, côté maximal, temps total. */
const MAX_FRAMES = 1500;
const MAX_SIG_NODES = 120;
const SIG_DEPTH = 3;
const MAX_SIDE = 1200;
const MIN_SIDE = 8;
const BUDGET_MS = 4000;

const KIND: Partial<Record<NodeType, string>> = {
  TEXT: 'TEXT',
  INSTANCE: 'INSTANCE',
  FRAME: 'FRAME',
  GROUP: 'FRAME',
  RECTANGLE: 'RECT',
  ELLIPSE: 'SHAPE',
  VECTOR: 'SHAPE',
  BOOLEAN_OPERATION: 'SHAPE',
  LINE: 'SHAPE',
  STAR: 'SHAPE',
  POLYGON: 'SHAPE',
};

/** Première peinture visible : couleur unie en hex, sinon sa nature. */
function paintKey(paints: readonly Paint[] | typeof figma.mixed): string | null {
  if (paints === figma.mixed) return 'mixed';
  const p = paints.find((x) => x.visible !== false && (x.opacity ?? 1) > 0);
  if (!p) return null;
  if (p.type === 'SOLID') return rgbToHex(p.color).slice(0, 7).toLowerCase();
  return p.type === 'IMAGE' ? 'image' : 'gradient';
}

/** Signature visuelle bornée ; null si le calque est vide ou trop gros pour être un composant plausible. */
function signature(node: FrameNode | ComponentNode): VisualSig | null {
  const kids = node.children.filter((c) => c.visible);
  if (!kids.length) return null;
  const strokeColor = paintKey(node.strokes);
  const hugPrimary = node.layoutMode !== 'NONE' && node.primaryAxisSizingMode === 'AUTO';
  const hugCounter = node.layoutMode !== 'NONE' && node.counterAxisSizingMode === 'AUTO';
  const sig: VisualSig = {
    w: node.width,
    h: node.height,
    hug: node.layoutMode === 'VERTICAL' ? [hugCounter, hugPrimary] : [hugPrimary, hugCounter],
    radius: node.cornerRadius === figma.mixed ? node.topLeftRadius : node.cornerRadius,
    layout: node.layoutMode,
    pad: node.layoutMode === 'NONE' ? [0, 0, 0, 0] : [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
    gap: node.layoutMode === 'NONE' ? 0 : node.itemSpacing,
    fill: paintKey(node.fills),
    stroke: strokeColor ? `${strokeColor}@${node.strokeWeight === figma.mixed ? 'mixed' : node.strokeWeight}` : null,
    effects: node.effects.filter((e) => e.visible).length,
    kinds: kids.map((c) => KIND[c.type] ?? 'OTHER').sort(),
    fonts: [],
    colors: [],
    nodes: 0,
  };
  const fonts = new Set<string>();
  const colors = new Set<string>();
  let count = 0;
  const walk = (n: SceneNode, depth: number): boolean => {
    if (++count > MAX_SIG_NODES) return false;
    if (n.type === 'TEXT' && n.fontName !== figma.mixed && n.fontSize !== figma.mixed) fonts.add(`${n.fontName.family}|${n.fontName.style}|${n.fontSize}`);
    if ('fills' in n) {
      const k = paintKey((n as GeometryMixin).fills);
      if (k && k.startsWith('#') && colors.size < 12) colors.add(k);
    }
    if ('children' in n && depth < SIG_DEPTH) for (const c of (n as SceneNode & ChildrenMixin).children) if (c.visible && !walk(c, depth + 1)) return false;
    return true;
  };
  for (const c of kids) if (!walk(c, 1)) return null;
  sig.nodes = count;
  sig.fonts = [...fonts].sort();
  sig.colors = [...colors].sort();
  return sig;
}

const fits = (n: SceneNode) => n.width <= MAX_SIDE && n.height <= MAX_SIDE && n.width >= MIN_SIDE && n.height >= MIN_SIDE;

export const lookalikeRules: Rule[] = [
  {
    id: RULE_ID,
    types: ['FRAME', 'COMPONENT', 'INSTANCE'],
    check: async (node, ctx) => {
      // Candidats : composants locaux rencontrés, et composants de librairie qu'utilisent les instances.
      if (node.type === 'COMPONENT') {
        addComponent(ctx, node, 'local');
        return;
      }
      if (node.type === 'INSTANCE') {
        await noteInstance(ctx, node);
        return;
      }
      const frame = node as FrameNode;
      if (!fits(frame) || !frame.children.some((c) => c.visible)) return;
      if (ancestors(frame, ctx).some((a) => a.type === 'COMPONENT' || a.type === 'COMPONENT_SET' || a.type === 'INSTANCE')) return;
      if (ctx.lookalikeFrames.length >= MAX_FRAMES) {
        ctx.warnings.push(`rule-partial:${RULE_ID}`);
        return;
      }
      ctx.lookalikeFrames.push(frame);
    },
    finalize: async (ctx) => {
      // Les détachés dont l'origine est connue passent par le rattachement ; ici, les autres.
      const frames = ctx.lookalikeFrames.filter((f) => !f.removed && (!f.detachedInfo || ctx.reattachMissingOrigin.has(f.id)));
      if (!frames.length) return;
      // Candidats : page analysée, autres pages (option), librairies via les instances du fichier.
      const index = await buildComponentIndex(ctx);
      if (index.partial) ctx.warnings.push(`rule-partial:${RULE_ID}`);
      const comps = index.components.filter(fits);
      const t0 = Date.now();
      const candidates: LookalikeCandidate<ComponentNode>[] = [];
      for (let i = 0; i < comps.length; i++) {
        const comp = comps[i];
        const sig = signature(comp);
        if (sig) candidates.push({ sig, family: familyOf(comp), item: comp });
        if (i % 50 === 49) await yieldToHost();
      }
      if (!candidates.length) return;
      const out: RawIssue[] = [];
      for (let i = 0; i < frames.length; i++) {
        if (Date.now() - t0 > BUDGET_MS) {
          ctx.warnings.push(`rule-partial:${RULE_ID}`);
          break;
        }
        if (i % 20 === 19) await yieldToHost();
        const frame = frames[i];
        const sig = signature(frame);
        if (!sig) continue;
        // À score égal entre familles, le nom le plus proche du cadre l'emporte ; les autres restent au menu.
        const found = bestLookalike(sig, candidates, (comp) => nameOverlap(frame.name, variantLabel(comp)));
        if (!found) continue;
        const comp = found.item;
        const frameTree = await toTree(frame, 0, newBudget());
        const result = matchTrees(frameTree, await toTree(comp, 0, newBudget()));
        const label = variantLabel(comp);
        const score = Math.round(found.score * 100);
        if (result.extras.length > MAX_FORCED_EXTRAS) {
          out.push({ ruleId: RULE_ID, node: frame, currentValue: frame.name, fixSafety: 'none', params: { confidence: 'none', component: label, score, detail: reasonDetail(result.reasons) } });
          continue;
        }
        const sum = summarizeOverrides(result);
        const alternatives: { id: string; label: string; value: string }[] = [];
        const alternativePlans: Record<string, ReturnType<typeof reattachPlan>> = {};
        for (const alt of found.alternatives) {
          const altResult = matchTrees(frameTree, await toTree(alt.item, 0, newBudget()));
          if (altResult.extras.length > MAX_FORCED_EXTRAS) continue;
          const id = `comp:${alt.item.id}`;
          alternatives.push({ id, label: variantLabel(alt.item), value: `${Math.round(alt.score * 100)} %` });
          alternativePlans[id] = reattachPlan(frame, alt.item, altResult, true);
        }
        out.push({
          ruleId: RULE_ID,
          node: frame,
          currentValue: frame.name,
          suggestion: { kind: 'component', id: comp.id, label, confidence: 'ambiguous', source: comp.remote ? 'Library' : 'Local', alternatives: alternatives.length ? alternatives : undefined },
          fixSafety: 'review',
          params: {
            confidence: 'lookalike',
            component: label,
            score,
            total: result.overrides.length,
            extras: result.extras.length,
            texts: sum.texts,
            visibility: sum.visibility,
            paints: sum.paints,
            detail: reasonDetail(result.reasons),
            ambiguous: alternatives.length,
            alt: alternatives[0]?.label ?? '',
          },
          plan: reattachPlan(frame, comp, result, true),
          alternativePlans: alternatives.length ? alternativePlans : undefined,
        });
      }
      return out;
    },
  },
];
