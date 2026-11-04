import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorKey, composite, contrastRatio, deltaE, evaluateContrast, formatRatio, hexToRgb, isBoldStyle, isLargeText, rgbToHex } from '../src/shared/color';

test('hex ↔ rgb round trip', () => {
  assert.equal(rgbToHex({ r: 1, g: 0.4, b: 0.2 }), '#FF6633');
  assert.deepEqual(hexToRgb('#FF6633'), { r: 1, g: 0.4, b: 0.2 });
  assert.equal(rgbToHex({ r: 0, g: 0, b: 0 }, 0.5), '#00000080');
  assert.equal(hexToRgb('nope'), null);
});

test('colorKey distingue l’alpha', () => {
  assert.notEqual(colorKey({ r: 1, g: 1, b: 1 }, 1), colorKey({ r: 1, g: 1, b: 1 }, 0.5));
  assert.equal(colorKey({ r: 1, g: 1, b: 1 }), colorKey({ r: 1, g: 1, b: 1 }, 1));
});

test('deltaE : identique = 0, blanc/noir = 100', () => {
  assert.equal(deltaE({ r: 1, g: 0, b: 0 }, { r: 1, g: 0, b: 0 }), 0);
  assert.ok(deltaE({ r: 1, g: 1, b: 1 }, { r: 0, g: 0, b: 0 }) > 99);
  // #FF6633 vs #FF6634 : indiscernable
  assert.ok(deltaE(hexToRgb('#FF6633')!, hexToRgb('#FF6634')!) < 1);
});

test('contraste WCAG', () => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 1, g: 1, b: 1 };
  assert.equal(Math.round(contrastRatio(black, white)), 21);
  assert.equal(formatRatio(contrastRatio(black, white)), '21:1');
  // #767676 sur blanc ≈ 4.54:1 (seuil AA classique)
  const grey = hexToRgb('#767676')!;
  const r = contrastRatio(grey, white);
  assert.ok(r > 4.5 && r < 4.6, String(r));
  assert.equal(evaluateContrast(r, false).level, 'AA');
  assert.equal(evaluateContrast(r, true).level, 'AAA'); // texte large : AAA dès 4.5
  assert.equal(evaluateContrast(3.5, true).level, 'AA-large');
  assert.equal(evaluateContrast(3.2, false).level, 'fail');
  assert.equal(evaluateContrast(3.2, true).passesAA, true);
});

test('composite : alpha 0 = fond, alpha 1 = couleur', () => {
  const fg = { r: 1, g: 0, b: 0 };
  const bg = { r: 0, g: 0, b: 1 };
  assert.deepEqual(composite(fg, 1, bg), fg);
  assert.deepEqual(composite(fg, 0, bg), bg);
  const half = composite(fg, 0.5, bg);
  assert.ok(Math.abs(half.r - 0.5) < 1e-9 && Math.abs(half.b - 0.5) < 1e-9);
});

test('texte large et gras', () => {
  assert.equal(isLargeText(24, false), true);
  assert.equal(isLargeText(18, false), false);
  assert.equal(isLargeText(19, true), true);
  assert.equal(isBoldStyle('Semi Bold'), true);
  assert.equal(isBoldStyle('Regular'), false);
});
