import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestLookalike, LOOKALIKE_MIN, nameOverlap, plausible, similarity, type VisualSig } from '../src/shared/lookalike';

const sig = (over: Partial<VisualSig> = {}): VisualSig => ({
  w: 94,
  h: 33,
  hug: [false, false],
  stretch: [false, false],
  radius: 8,
  layout: 'HORIZONTAL',
  pad: [8, 16, 8, 16],
  gap: 8,
  fill: '#ff6633',
  stroke: null,
  effects: 0,
  kinds: ['TEXT'],
  leafKinds: ['TEXT'],
  texts: 1,
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
  const card = sig({ w: 320, h: 200, fill: '#ffffff', kinds: ['RECT', 'TEXT', 'TEXT'], leafKinds: ['IMAGE', 'TEXT', 'TEXT'], texts: 2, fonts: ['Inter|Semi Bold|18', 'Inter|Regular|12'], colors: ['#d9d9d9', '#1a1a1f'] });
  assert.equal(plausible(card, button), false);
  // Même taille mais fond et contenu différents : surface différente, donc exclu avant le score.
  const plain = sig({ fill: '#ffffff', kinds: ['RECT'], leafKinds: ['SHAPE'], texts: 0, fonts: [], colors: ['#000000'] });
  assert.equal(plausible(plain, button), false);
});

test('une carte étirée en largeur, à l’imbrication différente, ressemble à la variante de carte (cas réel)', () => {
  // Composant : vertical, 656×188, hauteur ajustée au contenu, icône + 8 textes.
  const cardComponent = sig({
    w: 656,
    h: 188,
    hug: [false, true],
    layout: 'VERTICAL',
    pad: [16, 16, 16, 16],
    gap: 0,
    fill: '#faf8f2',
    radius: 16,
    kinds: ['FRAME'],
    leafKinds: ['ICON', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT'],
    texts: 8,
    fonts: ['Onest|SemiBold|20', 'Alegreya Sans|Regular|20', 'Onest|SemiBold|24', 'Alegreya Sans|Regular|14'],
    colors: ['#000000', '#1a1a1a', '#fefefe', '#e40412'],
  });
  // Copie : horizontale, étirée à 1044 px dans son parent, image à la place de l'icône, mêmes textes et polices.
  const copy = sig({
    w: 1044,
    h: 220,
    stretch: [true, false],
    layout: 'HORIZONTAL',
    pad: [16, 16, 16, 16],
    gap: 24,
    fill: '#faf8f2',
    radius: 16,
    kinds: ['FRAME', 'RECT'],
    leafKinds: ['IMAGE', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT'],
    texts: 8,
    fonts: ['Onest|SemiBold|20', 'Alegreya Sans|Regular|20', 'Onest|SemiBold|24', 'Alegreya Sans|Regular|14'],
    colors: ['#000000', '#1a1a1a'],
  });
  assert.ok(plausible(copy, cardComponent));
  assert.ok(similarity(copy, cardComponent) >= LOOKALIKE_MIN, `score ${similarity(copy, cardComponent)}`);
  // Une autre variante (verticale, « Information » : pas de statistiques) reste moins proche.
  const infoVariant = sig({ ...cardComponent, leafKinds: ['ICON', 'TEXT', 'TEXT'], texts: 2, fonts: ['Onest|SemiBold|20', 'Alegreya Sans|Regular|20'] });
  assert.ok(similarity(copy, infoVariant) < similarity(copy, cardComponent));
});

test('empreinte de contenu forte : largeur libre, rayon retouché et contour fin ne cachent pas la parenté (signatures réelles)', () => {
  const statistic = sig({
    w: 656, h: 188, hug: [false, true], layout: 'VERTICAL', pad: [24, 24, 24, 24], gap: 16, fill: '#faf8f2', radius: 24, stroke: null,
    kinds: ['FRAME'], leafKinds: ['ICON', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT'], texts: 8,
    fonts: ['Alegreya Sans|Regular|14', 'Alegreya Sans|Regular|20', 'Onest|Bold|32', 'Onest|SemiBold|20'], colors: ['#1a1a1a', '#1a5244', '#4a4a4a'],
  });
  const frame58 = sig({
    w: 1044, h: 220, hug: [false, true], layout: 'HORIZONTAL', pad: [20, 16, 20, 16], gap: 8, fill: '#faf8f2', radius: 16, stroke: '#f5efe5@1',
    kinds: ['FRAME', 'RECT'], leafKinds: ['IMAGE', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT'], texts: 8,
    fonts: ['Alegreya Sans|Regular|14', 'Alegreya Sans|Regular|20', 'Onest|Bold|32', 'Onest|SemiBold|20'], colors: ['#000000', '#1a1a1a', '#1a5244', '#4a4a4a'],
  });
  assert.ok(plausible(frame58, statistic));
  assert.ok(similarity(frame58, statistic) >= LOOKALIKE_MIN, `score ${similarity(frame58, statistic)}`);
  // Les autres variantes du jeu (Information : 3 textes, autres polices ; Action : 3 textes) restent derrière.
  const information = sig({ ...statistic, w: 316, h: 388, hug: [false, false], leafKinds: ['ICON', 'TEXT', 'TEXT', 'TEXT'], texts: 3, fonts: ['Alegreya Sans|Bold|14', 'Alegreya Sans|Regular|16', 'Onest|SemiBold|20'], colors: ['#46484c', '#ebe0cc'] });
  const action = sig({ ...statistic, w: 491, h: 80, layout: 'HORIZONTAL', leafKinds: ['ICON', 'ICON', 'TEXT', 'TEXT', 'TEXT'], texts: 3, fonts: ['Alegreya Sans|Bold|16', 'Alegreya Sans|Regular|16', 'Alegreya Sans|Regular|18'], colors: ['#1a1a1a', '#1a5244', '#ffffff'] });
  assert.equal(plausible(frame58, information), false);
  assert.ok(similarity(frame58, action) < similarity(frame58, statistic));
  const found = bestLookalike(frame58, [
    { sig: information, family: 'card', item: 'Information' },
    { sig: action, family: 'card', item: 'Action' },
    { sig: statistic, family: 'card', item: 'Statistic' },
  ]);
  assert.equal(found?.item, 'Statistic');
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

test('un bouton qui s’ajuste à son texte tolère un libellé plus long ; sans ajustement, un grand écart exclut', () => {
  const hugButton = sig({ hug: [true, false] });
  const longer = sig({ w: 130, kinds: ['FRAME'], nodes: 2 }); // +38 % de largeur
  assert.ok(plausible(longer, hugButton));
  assert.ok(similarity(longer, hugButton) >= LOOKALIKE_MIN);
  assert.equal(plausible(longer, sig()), false);
});

test('le score baisse avec la taille, le rayon et la mise en page', () => {
  const ref = sig();
  assert.ok(similarity(sig({ w: 110 }), ref) < similarity(sig({ w: 96 }), ref));
  assert.ok(similarity(sig({ radius: 0 }), ref) < similarity(ref, ref));
  assert.ok(similarity(sig({ layout: 'NONE' }), ref) < similarity(ref, ref));
  assert.equal(Math.round(similarity(ref, ref) * 100), 100);
});
