import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isInteger, isOnGrid, matchScale, px } from '../src/shared/scale';

const scale = [4, 8, 12, 16, 24, 32].map((v) => ({ value: v, ref: `space-${v}` }));

test('exact match', () => {
  const m = matchScale(16, scale, 2);
  assert.equal(m.confidence, 'exact');
  assert.equal(m.best?.ref, 'space-16');
});

test('close match : 18 → 16 (ambigu avec 20 absent → close)', () => {
  const m = matchScale(18, scale, 2);
  assert.equal(m.confidence, 'close');
  assert.equal(m.best?.ref, 'space-16');
});

test('ambiguous : 20 est à égale distance de 16 et 24', () => {
  const m = matchScale(20, scale, 4);
  assert.equal(m.confidence, 'ambiguous');
  assert.equal(m.candidates.length, 2);
});

test('none : hors tolérance', () => {
  assert.equal(matchScale(100, scale, 2).confidence, 'none');
  assert.equal(matchScale(10, [], 2).confidence, 'none');
});

test('grille et entiers', () => {
  assert.equal(isOnGrid(16, 4), true);
  assert.equal(isOnGrid(18, 4), false);
  assert.equal(isOnGrid(0, 8), true);
  assert.equal(isInteger(12.004), true);
  assert.equal(isInteger(12.5), false);
  assert.equal(px(13.3333), '13.33 px');
  assert.equal(px(16), '16 px');
});
