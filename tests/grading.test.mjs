import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOKS, LUT_SIZE, gradeColour, lutIndex, lutTable } from '../src/grading.ts';
import { ENVIRONMENTS } from '../src/environments.ts';

const close = (a, b, eps = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) <= eps);
const greys = [0, .1, .25, .5, .75, .9, 1];

test('the empty grade leaves every colour as it is', () => {
  for (const c of [[0, 0, 0], [1, 1, 1], [.2, .5, .8], [.9, .1, .3]]) assert.ok(close(gradeColour({}, c), c), String(c));
});

test('contrast, saturation and even lift, gamma and gain keep neutral greys neutral and black black', () => {
  const grade = { contrast: 1.2, saturation: 1.3, gamma: [1.1, 1.1, 1.1], gain: [.95, .95, .95] };
  for (const v of greys) { const [r, g, b] = gradeColour(grade, [v, v, v]); assert.ok(Math.abs(r - g) < 1e-9 && Math.abs(g - b) < 1e-9, `grey ${v}`); }
  assert.ok(close(gradeColour(grade, [0, 0, 0]), [0, 0, 0]));
  assert.ok(close(gradeColour({ contrast: 1.3 }, [1, 1, 1]), [1, 1, 1]));
});

test('split toning tints the shade and the light but never lifts black', () => {
  const grade = { shadows: [-.02, 0, .04], highlights: [.03, .01, -.02] };
  assert.ok(close(gradeColour(grade, [0, 0, 0]), [0, 0, 0]));
  const [r, , b] = gradeColour(grade, [.2, .2, .2]);
  assert.ok(b > r, 'cool shade');
});

test('warmer white balance moves greys towards amber without changing their brightness much', () => {
  const [r, g, b] = gradeColour({ temperature: .3 }, [.5, .5, .5]);
  assert.ok(r > g && g > b);
  assert.ok(Math.abs(.2126 * r ** 2.2 + .7152 * g ** 2.2 + .0722 * b ** 2.2 - .5 ** 2.2) < .005);
});

test('every scene has a look, and every look keeps the palette: no crushed blacks, no blown whites, mid grey near itself', () => {
  for (const id of Object.keys(ENVIRONMENTS)) assert.ok(LOOKS[id], id);
  for (const [id, { grade }] of Object.entries(LOOKS)) {
    const black = gradeColour(grade, [0, 0, 0]), white = gradeColour(grade, [1, 1, 1]), mid = gradeColour(grade, [.5, .5, .5]);
    assert.ok(Math.max(...black) <= .03, `${id} lifts black to ${black}`);
    assert.ok(Math.min(...white) >= .85, `${id} dims white to ${white}`);
    assert.ok(mid.every(x => Math.abs(x - .5) <= .08), `${id} moves mid grey to ${mid}`);
    // Order is kept: a darker grey never comes out brighter than a lighter one.
    const lum = greys.map(v => { const [r, g, b] = gradeColour(grade, [v, v, v]); return r + g + b; });
    lum.slice(1).forEach((l, i) => assert.ok(l >= lum[i] - 1e-9, `${id} inverts greys`));
  }
});

test('the LUT is the engine\'s 256×16 strip: blue picks the slice, red runs across it, green down', () => {
  const table = lutTable({}), n = LUT_SIZE - 1;
  assert.equal(table.length, 256 * 16 * 3);
  for (const [r, g, b] of [[0, 0, 0], [15, 0, 0], [0, 15, 0], [0, 0, 15], [3, 7, 11]]) {
    const i = lutIndex(r, g, b) * 3;
    assert.ok(close(table.subarray(i, i + 3), [r / n, g / n, b / n]), `${r},${g},${b}`);
  }
  assert.equal(lutIndex(15, 0, 1), 31);
  assert.equal(lutIndex(0, 1, 0), 256);
  assert.equal(lutTable(LOOKS.patio.grade), lutTable(LOOKS.patio.grade), 'built once');
});
