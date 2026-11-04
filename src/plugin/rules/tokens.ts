/// <reference types="@figma/plugin-typings" />
/** Architecture des tokens (Pro) : alias, orphelins, doublons, niveaux d'abstraction, modes, scopes. */
import { colorKey, rgbToHex } from '../../shared/color';
import { looksPrimitiveToken, looksSemanticToken } from '../../shared/names';
import type { RawIssue, ScanContext, VirtualTarget } from '../scan/context';
import { resolveSolidPaint } from '../scan/node-info';
import { tokenLabel } from './match-color';
import type { Rule } from './types';

const isAlias = (v: VariableValue): v is VariableAlias => typeof v === 'object' && v !== null && 'type' in v && (v as VariableAlias).type === 'VARIABLE_ALIAS';

function virtualOf(v: Variable, ctx: ScanContext): VirtualTarget {
  const col = ctx.collectionsById.get(v.variableCollectionId);
  return { id: v.id, name: v.name, type: 'VARIABLE', path: [col?.name ?? 'Variables'] };
}

/** Collecte toutes les variables liées à un node (fills, strokes, propriétés numériques, propriétés de composant). */
function collectBound(value: unknown, out: Set<string>, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 3) return;
  if (Array.isArray(value)) {
    for (const v of value) collectBound(v, out, depth + 1);
    return;
  }
  const obj = value as Record<string, unknown>;
  if (obj.type === 'VARIABLE_ALIAS' && typeof obj.id === 'string') {
    out.add(obj.id);
    return;
  }
  for (const v of Object.values(obj)) collectBound(v, out, depth + 1);
}

const PAINT_TYPES: NodeType[] = ['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'VECTOR', 'TEXT', 'LINE', 'BOOLEAN_OPERATION', 'SECTION', 'GROUP', 'COMPONENT_SET'];

const valueKey = (v: VariableValue): string => {
  if (isAlias(v)) return `alias:${v.id}`;
  if (typeof v === 'object' && v !== null && 'r' in v) {
    const c = v as RGBA;
    return colorKey({ r: c.r, g: c.g, b: c.b }, 'a' in c ? c.a : 1);
  }
  return `${typeof v}:${String(v)}`;
};

export const tokenRules: Rule[] = [
  {
    // Collecte des usages (toutes les règles tokens aggregate en profitent) + orphelins en périmètre fichier.
    id: 'tokens/orphan',
    types: PAINT_TYPES,
    insideInstances: true,
    check: (node, ctx) => {
      collectBound((node as SceneNode & { boundVariables?: unknown }).boundVariables, ctx.usedVariableIds);
      if (node.type === 'TEXT') {
        try {
          const ranges = (node as TextNode).getStyledTextSegments(['boundVariables']);
          for (const r of ranges) collectBound(r.boundVariables, ctx.usedVariableIds);
        } catch {
          /* texte mixte illisible */
        }
      }
    },
    finalize: (ctx) => {
      if (ctx.scope !== 'file') return; // « jamais utilisé » n'a de sens que sur tout le fichier
      const aliased = new Set<string>();
      for (const v of ctx.localVariables) for (const val of Object.values(v.valuesByMode)) if (isAlias(val)) aliased.add(val.id);
      const out: RawIssue[] = [];
      for (const v of ctx.localVariables) {
        if (ctx.usedVariableIds.has(v.id) || aliased.has(v.id)) continue;
        out.push({ ruleId: 'tokens/orphan', virtual: virtualOf(v, ctx), currentValue: v.name, fixSafety: 'none', params: { name: v.name } });
      }
      return out;
    },
  },
  {
    id: 'tokens/broken-alias',
    finalize: async (ctx) => {
      const out: RawIssue[] = [];
      for (const v of ctx.localVariables) {
        for (const [modeId, val] of Object.entries(v.valuesByMode)) {
          if (!isAlias(val)) continue;
          const target = await figma.variables.getVariableByIdAsync(val.id);
          if (target) continue;
          const col = ctx.collectionsById.get(v.variableCollectionId);
          const mode = col?.modes.find((m) => m.modeId === modeId)?.name ?? modeId;
          out.push({ ruleId: 'tokens/broken-alias', virtual: virtualOf(v, ctx), slot: modeId, currentValue: v.name, fixSafety: 'none', params: { name: v.name, mode } });
        }
      }
      return out;
    },
  },
  {
    id: 'tokens/circular-alias',
    finalize: (ctx) => {
      const byId = new Map(ctx.localVariables.map((v) => [v.id, v]));
      const out: RawIssue[] = [];
      const reported = new Set<string>();
      for (const v of ctx.localVariables) {
        for (const [modeId, val] of Object.entries(v.valuesByMode)) {
          if (!isAlias(val)) continue;
          const seen = new Set<string>([v.id]);
          let cur: Variable | undefined = byId.get(val.id);
          const chain = [v.name];
          while (cur) {
            chain.push(cur.name);
            if (seen.has(cur.id)) {
              if (!reported.has(v.id)) {
                reported.add(v.id);
                out.push({ ruleId: 'tokens/circular-alias', virtual: virtualOf(v, ctx), currentValue: chain.join(' → '), fixSafety: 'none', params: { name: v.name, chain: chain.join(' → ') } });
              }
              break;
            }
            seen.add(cur.id);
            const next = cur.valuesByMode[modeId] ?? Object.values(cur.valuesByMode)[0];
            cur = isAlias(next) ? byId.get(next.id) : undefined;
          }
        }
      }
      return out;
    },
  },
  {
    id: 'tokens/duplicate-value',
    finalize: (ctx) => {
      const groups = new Map<string, Variable[]>();
      for (const v of ctx.localVariables) {
        if (v.resolvedType !== 'COLOR' && v.resolvedType !== 'FLOAT') continue;
        const values = Object.entries(v.valuesByMode)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([m, val]) => `${m}=${valueKey(val)}`);
        if (values.some((x) => x.includes('alias:'))) continue; // les alias sont des doublons voulus
        // Même collection, même type, mêmes scopes : radius/8 et space/8 sont des rôles différents, pas des doublons.
        const key = `${v.variableCollectionId}|${v.resolvedType}|${[...v.scopes].sort().join(',')}|${values.join(';')}`;
        groups.set(key, [...(groups.get(key) ?? []), v]);
      }
      const out: RawIssue[] = [];
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        for (const v of list) {
          const first = Object.values(v.valuesByMode)[0];
          const swatch = v.resolvedType === 'COLOR' && typeof first === 'object' && first && 'r' in first ? rgbToHex(first as RGB) : undefined;
          out.push({
            ruleId: 'tokens/duplicate-value',
            virtual: virtualOf(v, ctx),
            currentValue: v.name,
            swatch,
            fixSafety: 'none',
            params: { name: v.name, others: list.filter((o) => o !== v).map((o) => o.name).slice(0, 3).join(', '), count: list.length },
          });
        }
      }
      return out;
    },
  },
  {
    id: 'tokens/primitive-bound',
    types: PAINT_TYPES,
    check: async (node, ctx) => {
      const out: RawIssue[] = [];
      const hasSemantic = ctx.colors.some((t) => looksSemanticToken(t.name));
      if (!hasSemantic) return;
      for (const prop of ['fills', 'strokes'] as const) {
        if (!(prop in node)) continue;
        const paints = (node as GeometryMixin)[prop];
        if (paints === figma.mixed) continue;
        for (let i = 0; i < paints.length; i++) {
          const p = paints[i];
          if (p.type !== 'SOLID' || p.visible === false) continue;
          const id = p.boundVariables?.color?.id;
          if (!id) continue;
          const token = ctx.colorById.get(id);
          if (!token || !looksPrimitiveToken(token.name, token.collection)) continue;
          const { rgb, alpha } = await resolveSolidPaint(p, node);
          const semantic = (ctx.colorByKey.get(colorKey(rgb, alpha)) ?? []).filter((t) => looksSemanticToken(t.name) && t.id !== id);
          const best = semantic[0];
          out.push({
            ruleId: 'tokens/primitive-bound',
            node,
            slot: `${prop}[${i}]`,
            currentValue: token.name,
            swatch: rgbToHex(rgb),
            suggestion: best
              ? {
                  kind: 'variable',
                  id: best.id,
                  label: tokenLabel(best),
                  swatch: rgbToHex(best.rgb),
                  confidence: 'exact',
                  alternatives: semantic.slice(1, 4).map((t) => ({ id: `var:${t.id}`, label: tokenLabel(t), swatch: rgbToHex(t.rgb) })),
                }
              : undefined,
            fixSafety: best ? 'review' : 'none',
            params: { token: token.name, prop, semantic: best ? tokenLabel(best) : '', confidence: best ? 'exact' : 'none' },
            plan: best ? { kind: 'bind-paint-variable', nodeId: node.id, prop, index: i, variableId: best.id } : undefined,
            alternativePlans: Object.fromEntries(semantic.slice(1, 4).map((t) => [`var:${t.id}`, { kind: 'bind-paint-variable', nodeId: node.id, prop, index: i, variableId: t.id }])),
          });
        }
      }
      return out;
    },
  },
  {
    id: 'tokens/mode-gap',
    finalize: (ctx) => {
      const out: RawIssue[] = [];
      for (const col of ctx.collectionsById.values()) {
        if (col.modes.length < 2) continue;
        const vars = ctx.localVariables.filter((v) => v.variableCollectionId === col.id && v.resolvedType === 'COLOR');
        if (vars.length < 4) continue;
        const differs = (v: Variable) => new Set(col.modes.map((m) => valueKey(v.valuesByMode[m.modeId]))).size > 1;
        const differing = vars.filter(differs).length;
        if (differing < vars.length / 2) continue; // la collection ne varie pas vraiment par mode
        for (const v of vars) {
          if (differs(v)) continue;
          out.push({
            ruleId: 'tokens/mode-gap',
            virtual: virtualOf(v, ctx),
            currentValue: v.name,
            fixSafety: 'none',
            params: { name: v.name, modes: col.modes.map((m) => m.name).join(' / '), collection: col.name },
          });
        }
      }
      return out;
    },
  },
  {
    id: 'tokens/unscoped',
    finalize: (ctx) => {
      const colors = ctx.localVariables.filter((v) => v.resolvedType === 'COLOR');
      if (colors.length < 4) return;
      const scoped = colors.filter((v) => !v.scopes.includes('ALL_SCOPES')).length;
      if (scoped < colors.length / 2) return; // le fichier ne pratique pas le scoping
      const out: RawIssue[] = [];
      for (const v of colors) {
        if (!v.scopes.includes('ALL_SCOPES')) continue;
        out.push({ ruleId: 'tokens/unscoped', virtual: virtualOf(v, ctx), currentValue: v.name, fixSafety: 'none', params: { name: v.name } });
      }
      return out;
    },
  },
];
