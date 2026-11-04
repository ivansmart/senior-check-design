import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forcedCost, matchTrees, summarizeOverrides, type TreeNode } from '../src/shared/reattach';

const n = (type: string, name: string, extra: Partial<TreeNode> = {}, children: TreeNode[] = []): TreeNode => ({
  type,
  name,
  visible: true,
  opacity: 1,
  children,
  ...extra,
});
const text = (name: string, value: string, extra: Partial<TreeNode> = {}) =>
  n('TEXT', name, { text: value, fontName: { family: 'Inter', style: 'Regular' }, fontSize: 14, textStyleId: '', fillsKey: 'f1', fills: [{ type: 'SOLID' }], ...extra });

const component = () =>
  n('COMPONENT', 'Button / Pay', {}, [
    n('INSTANCE', 'Icon', { mainId: 'c:icon', mainRemote: false, fillsKey: 'f0', fills: [] }),
    text('Label', 'Payer'),
    n('FRAME', 'Badge', { fillsKey: 'f2', fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] }, [text('Count', '1')]),
  ]);

test('structure identique sans différence : rattachement exact, aucun override', () => {
  const detached = component();
  detached.type = 'FRAME';
  const r = matchTrees(detached, component());
  assert.equal(r.ok, true);
  assert.deepEqual(r.overrides, []);
  assert.equal(r.stats.matched, 4);
});

test('texte, calque masqué et couleur modifiés : reproduits par overrides', () => {
  const detached = n('FRAME', 'Button / Pay', {}, [
    n('INSTANCE', 'Icon', { mainId: 'c:icon', mainRemote: false, fillsKey: 'f0', fills: [] }),
    text('Label', 'Payer maintenant'),
    n('FRAME', 'Badge', { visible: false, fillsKey: 'f9', fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }] }, [text('Count', '3')]),
  ]);
  const r = matchTrees(detached, component());
  assert.equal(r.ok, true);
  const s = summarizeOverrides(r);
  assert.equal(s.texts, 2);
  assert.equal(s.visibility, 1);
  assert.equal(s.paints, 1);
  assert.ok(r.overrides.some((o) => o.op === 'text' && o.value === 'Payer maintenant' && o.path.join('.') === '1'));
  assert.ok(r.overrides.some((o) => o.op === 'visible' && o.value === false && o.path.join('.') === '2'));
});

test('calque du composant supprimé dans le détaché : masqué dans l’instance', () => {
  const detached = n('FRAME', 'Button / Pay', {}, [text('Label', 'Payer'), n('FRAME', 'Badge', { fillsKey: 'f2', fills: [] }, [text('Count', '1')])]);
  const r = matchTrees(detached, component());
  assert.equal(r.ok, true);
  assert.ok(r.overrides.some((o) => o.op === 'visible' && o.value === false && o.path.join('.') === '0'));
  assert.equal(r.stats.hidden, 1);
});

test('calque ajouté à la main ou type différent : rattachement impossible', () => {
  const added = component();
  added.type = 'FRAME';
  added.children.push(n('RECTANGLE', 'Extra'));
  const r1 = matchTrees(added, component());
  assert.equal(r1.ok, false);
  assert.ok(r1.reasons.includes('added:Extra'));
  assert.deepEqual(r1.extras, [[3]]);
  assert.ok(forcedCost(r1) > 0);

  const retyped = n('FRAME', 'Button / Pay', {}, [n('RECTANGLE', 'Icon'), text('Label', 'Payer'), n('FRAME', 'Badge', { fillsKey: 'f2', fills: [] }, [text('Count', '1')])]);
  const r2 = matchTrees(retyped, component());
  assert.equal(r2.ok, false);
});

test('calque renommé : override de nom ; police mixte : impossible ; échange d’instance locale : override', () => {
  const renamed = component();
  renamed.type = 'FRAME';
  renamed.children[1].name = 'Libellé';
  renamed.children[0].mainId = 'c:icon-2';
  const r = matchTrees(renamed, component());
  assert.equal(r.ok, true);
  assert.ok(r.overrides.some((o) => o.op === 'name' && o.value === 'Libellé'));
  assert.ok(r.overrides.some((o) => o.op === 'swap' && o.componentId === 'c:icon-2'));

  const mixed = component();
  mixed.type = 'FRAME';
  mixed.children[1].fontName = 'mixed';
  mixed.children[1].text = 'Régler';
  const rm = matchTrees(mixed, component());
  assert.equal(rm.ok, false);
  assert.ok(rm.overrides.some((o) => o.op === 'text' && o.value === 'Régler'), 'le texte seul est reporté en mode forcé');

  const remote = component();
  remote.type = 'FRAME';
  remote.children[0].mainId = 'c:lib';
  remote.children[0].mainRemote = true;
  remote.children[0].mainKey = 'KEY-LIB';
  const rr = matchTrees(remote, component());
  assert.equal(rr.ok, true);
  assert.ok(rr.overrides.some((o) => o.op === 'swap' && o.componentKey === 'KEY-LIB'));
});

test('copie à la main : texte posé dans un cadre d’habillage, ou l’inverse, apparié sans ajout', () => {
  // Composant : TEXT direct ; copie : FRAME Wrap (sans peinture) > TEXT
  const comp = n('COMPONENT', 'Button', {}, [text('Label', 'Payer')]);
  const hand = n('FRAME', 'CTA', {}, [n('FRAME', 'Wrap', { fills: [], strokes: [] }, [text('Texte', 'Acheter')])]);
  const r = matchTrees(hand, comp);
  assert.equal(r.ok, true);
  assert.deepEqual(r.extras, []);
  assert.ok(r.overrides.some((o) => o.op === 'text' && o.value === 'Acheter' && o.path.join('.') === '0'));
  assert.equal(r.stats.hidden, 0);
  // Inverse : composant FRAME Content > TEXT ; copie : TEXT direct
  const comp2 = n('COMPONENT', 'Button', {}, [n('FRAME', 'Content', { fills: [], strokes: [] }, [text('Label', 'Payer')])]);
  const hand2 = n('FRAME', 'CTA', {}, [text('Texte', 'Acheter')]);
  const r2 = matchTrees(hand2, comp2);
  assert.equal(r2.ok, true);
  assert.ok(r2.overrides.some((o) => o.op === 'text' && o.value === 'Acheter' && o.path.join('.') === '0.0'));
  // Un cadre avec un fond visible n'est pas un simple habillage : il reste un ajout.
  const pill = n('FRAME', 'CTA', {}, [n('FRAME', 'Pill', { fills: [{ type: 'SOLID', visible: true }], strokes: [] }, [text('Texte', 'Acheter')])]);
  assert.equal(matchTrees(pill, comp).ok, false);
});

test('calque ajouté dans un enfant : chemin détaché précis pour le mode forcé', () => {
  const detached = component();
  detached.type = 'FRAME';
  detached.children[2].children.push(n('VECTOR', 'Sparkle'));
  const r = matchTrees(detached, component());
  assert.equal(r.ok, false);
  assert.deepEqual(r.extras, [[2, 1]]);
});
