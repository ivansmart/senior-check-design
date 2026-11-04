import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visualPaintKey } from '../src/shared/paint-key';
import { matchTrees, type TreeNode } from '../src/shared/reattach';

const solid = (r: number, g: number, b: number, extra: Record<string, unknown> = {}) => ({ type: 'SOLID', visible: true, opacity: 1, blendMode: 'NORMAL', color: { r, g, b }, ...extra });

test('clé visuelle : même couleur liée à une variable ou codée en dur, même clé ; peinture masquée ignorée', () => {
  const bound = [solid(1, 0.4, 0.2, { boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:3' } } })];
  const raw = [solid(1, 0.4, 0.2, { boundVariables: {} })];
  assert.equal(visualPaintKey(bound), visualPaintKey(raw));
  assert.equal(visualPaintKey(raw), 'S|#ff6633|100');
  assert.equal(visualPaintKey([solid(0, 0, 0, { visible: false }), ...raw]), visualPaintKey(raw));
  assert.notEqual(visualPaintKey([solid(1, 0.4, 0.2, { opacity: 0.5 })]), visualPaintKey(raw));
  assert.equal(visualPaintKey([{ type: 'GRADIENT_LINEAR', gradientStops: [{ color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 }, { color: { r: 0, g: 0, b: 0, a: 0.5 }, position: 1 }] }]), 'GRADIENT_LINEAR|100|#ffffff@100:0,#000000@50:100');
});

test('rattachement : un fond identique mais non lié au token ne produit pas d’override (le token du composant est conservé)', () => {
  const node = (fills: unknown[], children: TreeNode[] = []): TreeNode => ({ type: 'FRAME', name: 'Button', visible: true, opacity: 1, fills, fillsKey: JSON.stringify(fills), fillsVisual: visualPaintKey(fills), children });
  const comp = node([solid(1, 0.4, 0.2, { boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:3' } } })]);
  comp.type = 'COMPONENT';
  const hand = node([solid(1, 0.4, 0.2, { boundVariables: {} })]);
  const r = matchTrees(hand, comp);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overrides, []);
  // Couleur réellement différente : override.
  const other = node([solid(0, 0, 1)]);
  assert.ok(matchTrees(other, comp).overrides.some((o) => o.op === 'fills'));
});
