import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalState, inferComponentKind, isDefaultName, isStateProperty, looksLikeLongAction, normalizeStateValue } from '../src/shared/names';

test('noms par défaut Figma', () => {
  for (const n of ['Frame 47', 'Rectangle 12', 'Group 3', 'Frame', 'Component 2', 'Vector 6', 'Ellipse 1 copy', 'Union']) assert.equal(isDefaultName(n), true, n);
  for (const n of ['Card / Header', 'Button', 'Frame principal', 'Price badge', 'Group of friends']) assert.equal(isDefaultName(n), false, n);
});

test('normalisation des états', () => {
  assert.equal(normalizeStateValue('State=Hover'), 'hover');
  assert.equal(normalizeStateValue(':hover'), 'hover');
  assert.equal(normalizeStateValue('Mouse Over'), 'mouse-over');
  assert.equal(canonicalState('Hover'), 'hover');
  assert.equal(canonicalState('state-hover'), 'hover');
  assert.equal(canonicalState('Focused'), 'focus');
  assert.equal(canonicalState('Désactivé'), 'disabled');
  assert.equal(canonicalState('Checked'), 'selected');
  assert.equal(canonicalState('Hover + Focus'), 'hover');
  assert.equal(canonicalState('Primary'), null);
});

test('propriété d’état', () => {
  assert.equal(isStateProperty('State', ['Default', 'Hover']), true);
  assert.equal(isStateProperty('Interaction', ['A', 'B']), true);
  assert.equal(isStateProperty('Size', ['S', 'M', 'L']), false);
  assert.equal(isStateProperty('Mode', ['Default', 'Hover', 'Pressed']), true);
});

test('genre de composant', () => {
  assert.equal(inferComponentKind('Button / Primary'), 'button');
  assert.equal(inferComponentKind('Icon Button'), 'icon-button');
  assert.equal(inferComponentKind('Input / Text field'), 'input');
  assert.equal(inferComponentKind('Checkbox'), 'checkbox');
  assert.equal(inferComponentKind('Search bar'), 'search');
  assert.equal(inferComponentKind('Avatar'), 'unknown');
});

test('actions longues', () => {
  assert.equal(looksLikeLongAction('Button / Pay'), true);
  assert.equal(looksLikeLongAction('Ajouter au panier'), true);
  assert.equal(looksLikeLongAction('Cancel'), false);
});
