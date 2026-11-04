import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestLookalike, LOOKALIKE_MIN, nameOverlap, plausible, similarity, type VisualSig } from '../src/shared/lookalike';

const sig = (over: Partial<VisualSig> = {}): VisualSig => ({
  w: 94,
  h: 33,
  hug: [false, false],
  radius: 8,
  layout: 'HORIZONTAL',
  pad: [8, 16, 8, 16],
  gap: 8,
  fill: '#ff6633',
  stroke: null,
  effects: 0,
  kinds: ['TEXT'],
  fonts: ['Inter|Semi Bold|13'],
  colors: ['#ffffff'],
  nodes: 1,
  ...over,
});

test('un bouton recréé à la main ressemble au composant bouton (noms et imbrication différents)', () => {
  const button = sig();
  // Même rendu, texte posé dans un cadre intermédiaire, 2 px de différence de largeur.
  const handmade = sig({ w: 96, kinds: ['FRAME'], nodes: 2 });
  assert.ok(plausible(handmade, button));
  assert.ok(similarity(handmade, button) >= LOOKALIKE_MIN);
});

test('une carte ou un conteneur quelconque ne ressemble pas au bouton', () => {
  const button = sig();
  const card = sig({ w: 320, h: 200, fill: '#ffffff', kinds: ['RECT', 'TEXT', 'TEXT'], fonts: ['Inter|Semi Bold|18', 'Inter|Regular|12'], colors: ['#d9d9d9', '#1a1a1f'] });
  assert.equal(plausible(card, button), false);
  // Même taille mais fond et contenu différents : surface différente, donc exclu avant le score.
  const plain = sig({ fill: '#ffffff', kinds: ['RECT'], fonts: [], colors: ['#000000'] });
  assert.equal(plausible(plain, button), false);
});

test('bestLookalike choisit la variante la plus proche ; à égalité entre familles, le nom départage et l’autre reste en alternative', () => {
  const handmade = sig({ fill: '#cc4411' });
  const primary = sig();
  const primaryHover = sig({ fill: '#cc4411' });
  const danger = sig({ fill: '#cc4411', fonts: ['Inter|Semi Bold|13'] });
  // Deux variantes d'un même jeu : la plus proche (hover) gagne, sans alternative.
  const found = bestLookalike(handmade, [
    { sig: primary, family: 'set-button', item: 'default' },
    { sig: primaryHover, family: 'set-button', item: 'hover' },
  ]);
  assert.equal(found?.item, 'hover');
  assert.deepEqual(found?.alternatives, []);
  // Deux familles au score identique : l'ordre du document décide, l'autre famille est proposée en alternative.
  const tie = bestLookalike(handmade, [
    { sig: primaryHover, family: 'set-button', item: 'hover' },
    { sig: danger, family: 'set-danger', item: 'danger' },
  ]);
  assert.equal(tie?.item, 'hover');
  assert.equal(tie?.alternatives[0]?.item, 'danger');
  // Avec un nom proche du cadre, la famille « danger » passe devant.
  const named = bestLookalike(
    handmade,
    [
      { sig: primaryHover, family: 'set-button', item: 'Button / Primary / Hover' },
      { sig: danger, family: 'set-danger', item: 'Button / Danger / Default' },
    ],
    (label) => nameOverlap('btn danger copie', label),
  );
  assert.equal(named?.item, 'Button / Danger / Default');
  assert.equal(nameOverlap('Button / Pay', 'button pay copy'), 2);
});

test('un bouton qui s’ajuste à son texte tolère un libellé plus long', () => {
  const hugButton = sig({ hug: [true, false] });
  const longer = sig({ w: 118, kinds: ['FRAME'], nodes: 2 }); // +25 % de largeur : un autre libellé
  assert.ok(plausible(longer, hugButton));
  assert.ok(similarity(longer, hugButton) >= LOOKALIKE_MIN);
  // Sans ajustement au contenu, le même écart de largeur fait tomber le score.
  assert.ok(similarity(longer, sig()) < LOOKALIKE_MIN);
});

test('le score baisse avec la taille, le rayon et la mise en page', () => {
  const ref = sig();
  assert.ok(similarity(sig({ w: 110 }), ref) < similarity(sig({ w: 96 }), ref));
  assert.ok(similarity(sig({ radius: 0 }), ref) < similarity(ref, ref));
  assert.ok(similarity(sig({ layout: 'NONE' }), ref) < similarity(ref, ref));
  assert.equal(Math.round(similarity(ref, ref) * 100), 100);
});
