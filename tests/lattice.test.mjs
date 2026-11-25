import test from 'node:test';
import assert from 'node:assert/strict';
import { LATTICE_SHAPES, catenoidHeight, catenoidRadius, closedShape, latticeAim, latticeCell, latticeNeighbour, latticeReach, latticeShape, latticeSpacing, latticeUnshape, stringPulse, stringReflections } from '../src/lattice.ts';
import { FIGHT_FX } from '../src/effects.ts';

// The lattice's shape maps run on the GPU (WGSL in src/lattice.ts); these are their TypeScript twins.
const SHAPES = Object.keys(LATTICE_SHAPES);
const SIZE = { x: .5, y: .4, z: .3 };
const cells = grid => Array.from({ length: grid[0] * grid[1] * grid[2] }, (_, o) => latticeCell(grid, o));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

test('every cell of a grid lies inside its shape', () => {
  const grid = [9, 7, 5];
  for (const c of cells(grid)) {
    assert.ok(Math.max(Math.abs(c.x), Math.abs(c.y), Math.abs(c.z)) < 1, 'cells are cell-centred, inside −1…1');
    const ball = latticeShape('ball', c, SIZE);
    assert.ok((ball.x / SIZE.x) ** 2 + (ball.y / SIZE.y) ** 2 + (ball.z / SIZE.z) ** 2 <= 1 + 1e-9, 'inside the ball');
    const crystal = latticeShape('crystal', c, SIZE);
    assert.ok(Math.abs(crystal.x / SIZE.x) + Math.abs(crystal.y / SIZE.y) + Math.abs(crystal.z / SIZE.z) <= 1 + 1e-9, 'inside the double pyramid');
    const ring = latticeShape('ring', c, SIZE);
    const across = Math.hypot((Math.hypot(ring.x, ring.z) - SIZE.x) / SIZE.z, ring.y / SIZE.y);
    assert.ok(across <= 1 + 1e-9, 'inside the ring\'s tube');
    const column = latticeShape('column', c, SIZE);
    assert.ok((column.x / SIZE.x) ** 2 + (column.z / SIZE.z) ** 2 <= 1 + 1e-9 && Math.abs(column.y) <= SIZE.y, 'inside the column');
    const shield = latticeShape('shield', c, SIZE);
    assert.ok(Math.abs(shield.x) <= SIZE.x && Math.abs(shield.y) <= SIZE.y && shield.z >= -SIZE.z * .5 - 1e-9 && shield.z <= SIZE.z * 1.5 + 1e-9, 'inside the shield');
    if (shield.y < -SIZE.y * .5) assert.ok(Math.abs(shield.x) < SIZE.x * Math.abs(c.x) + 1e-9, 'narrowing to its point');
    const sphere = latticeShape('sphere', c, SIZE), r = Math.hypot(sphere.x / SIZE.x, sphere.y / SIZE.y, sphere.z / SIZE.x);
    assert.ok(Math.abs(r - 1) <= SIZE.z / SIZE.x + 1e-9, 'on the sphere\'s shell, within its thickness');
    const dome = latticeShape('dome', c, SIZE), rd = Math.hypot(dome.x / SIZE.x, dome.y / SIZE.y, dome.z / SIZE.x);
    assert.ok(Math.abs(rd - 1) <= SIZE.z / SIZE.x + 1e-9 && dome.y >= -1e-9, 'on the dome\'s shell, never under its rim');
  }
});

test('a point of a shape leads back to its own cell (how what is thrown at a lattice finds the member it hits)', () => {
  const grid = [10, 6, 6];
  for (const shape of SHAPES) {
    for (const c of cells(grid)) {
      const back = latticeUnshape(shape, latticeShape(shape, c, SIZE), SIZE);
      assert.ok(dist(back, c) < 1e-6, `${shape}: ${JSON.stringify(c)} came back as ${JSON.stringify(back)}`);
    }
  }
});

test('neighbouring cells stay neighbours in every shape and every blend between two, so morphing keeps the structure', () => {
  const grid = [12, 10, 8];
  for (const a of SHAPES) for (const b of SHAPES) for (const t of [0, .25, .5, .75, 1]) {
    const home = o => mix(latticeShape(a, latticeCell(grid, o), SIZE), latticeShape(b, latticeCell(grid, o), SIZE), t);
    const reach = Math.max(latticeReach(a, grid, SIZE), latticeReach(b, grid, SIZE));
    let longest = 0, seam = Infinity;
    for (let o = 0; o < grid[0] * grid[1] * grid[2]; o++) {
      for (let axis = 0; axis < 3; axis++) {
        const n = latticeNeighbour(grid, o, axis, 1);
        if (n < 0) continue;
        // The x seam of a box, a ball, a crystal or a column (its two ends) is not a bond; a ring closes it.
        if (axis === 0 && latticeCell(grid, o).x > latticeCell(grid, n).x) { seam = Math.min(seam, dist(home(o), home(n))); continue; }
        longest = Math.max(longest, dist(home(o), home(n)));
      }
    }
    // The shader drops any bond over three of the longest cell steps as a seam: every real bond is
    // within about one (a ball's radial map stretches a few a little), and the seam far past three.
    assert.ok(longest <= reach * 1.5, `${a} → ${b} at ${t}: a bond ${longest.toFixed(3)} m long, the longest step ${reach.toFixed(3)} m`);
    // (A shield's point is narrower than three cells: there its ends stay bonded, harmless unless it flows.)
    if (!closedShape(a) && !closedShape(b) && a !== 'shield' && b !== 'shield' && t % 1 === 0) assert.ok(seam > reach * 3, `${a}: its seam (${seam.toFixed(3)} m) reads as a seam`);
  }
});

test('a ring closes on itself: its last cell is its first cell\'s neighbour, and across the seam they sit a cell apart', () => {
  const grid = [24, 3, 3];
  const first = latticeShape('ring', latticeCell(grid, 0), SIZE), last = latticeShape('ring', latticeCell(grid, 23), SIZE);
  assert.equal(latticeNeighbour(grid, 0, 0, -1), 23);
  assert.ok(dist(first, last) <= latticeReach('ring', grid, SIZE) * 1.001, 'the seam is a bond like any other');
  assert.ok(latticeSpacing('ring', grid, SIZE) <= latticeReach('ring', grid, SIZE));
});

test('a sphere is a closed shell: every row a loop round it, its top and bottom rows round its poles', () => {
  const grid = [32, 12, 1], size = { x: .6, y: .6, z: .02 };
  const at = (i, j) => latticeShape('sphere', latticeCell(grid, i + grid[0] * j), size);
  assert.ok(dist(at(0, 5), at(31, 5)) <= latticeReach('sphere', grid, size) * 1.001, 'its rows close');
  assert.ok(at(0, 11).y > .58 && at(0, 0).y < -.58, 'its last row rings its top, its first its bottom');
  assert.ok(Math.abs(at(7, 6).y) < .1, 'its middle rows round its equator');
});

test('a shield is an escutcheon: a flat top as wide as it is, narrowing to a point, bent out in the middle', () => {
  const grid = [21, 24, 1], size = { x: .4, y: .5, z: .1 };
  const at = (i, j) => latticeShape('shield', latticeCell(grid, i + grid[0] * j), size);
  const width = j => at(20, j).x - at(0, j).x;
  assert.ok(width(23) > .7 && Math.abs(width(23) - width(15)) < 1e-9, 'its top half is as wide as the shield');
  assert.ok(width(0) < width(4) && width(4) < width(8) && width(0) < width(23) * .4, 'it narrows to its point');
  assert.ok(at(10, 12).z > at(0, 12).z + .08, 'its middle bends out towards the blows');
});

test('neighbours go past no edge but x, and every bond is seen from both ends', () => {
  const grid = [5, 4, 3];
  for (let o = 0; o < 60; o++) {
    for (let axis = 0; axis < 3; axis++) {
      for (const dir of [-1, 1]) {
        const n = latticeNeighbour(grid, o, axis, dir);
        if (axis === 0) assert.ok(n >= 0, 'x always has a neighbour (wrapping round)');
        if (n < 0) continue;
        assert.equal(latticeNeighbour(grid, n, axis, -dir), o, 'the bond runs both ways');
      }
    }
  }
  assert.equal(latticeNeighbour(grid, 0, 1, -1), -1, 'nothing below the bottom row');
  assert.equal(latticeNeighbour(grid, 59, 2, 1), -1, 'nothing past the last layer');
});

test('flowing, a lattice\'s cells scroll along x and wrap round, keeping their spacing', () => {
  const grid = [8, 1, 1];
  const still = latticeCell(grid, 3), moved = latticeCell(grid, 3, 2.5), round = latticeCell(grid, 3, 8);
  assert.ok(Math.abs(moved.x - still.x - 2.5 * 2 / 8) < 1e-9, 'two and a half cells along');
  assert.ok(Math.abs(round.x - still.x) < 1e-9, 'a whole lap brings it back');
  assert.ok(latticeCell(grid, 7, 1).x < latticeCell(grid, 0, 1).x, 'the last cell wraps round to the start');
});

test('a catenoid is the soap film between two rings: its rows close, its ends meet the rings, its waist the narrowest', () => {
  const grid = [40, 21, 1], size = { x: .5, y: .9, z: .25 };
  const at = (i, j) => latticeShape('catenoid', latticeCell(grid, i + grid[0] * j), size);
  const radius = j => Math.hypot(at(3, j).x, at(3, j).z);
  assert.ok(dist(at(0, 4), at(39, 4)) <= latticeReach('catenoid', grid, size) * 1.001, 'its rows close round it');
  assert.ok(Math.abs(radius(10) - .25) < 1e-9, 'its middle row is its waist');
  for (let j = 0; j < 10; j++) assert.ok(radius(j) > radius(j + 1) && Math.abs(radius(j) - radius(20 - j)) < 1e-9, 'narrowing to its waist, the same either side');
  assert.ok(Math.abs(catenoidRadius(1, .5, .25) - .5) < 1e-9 && Math.abs(catenoidRadius(-1, .5, .25) - .5) < 1e-9, 'it meets both rings');
  // Its true height: a·cosh(h/a) = R at h = a·acosh(R/a); a minimal surface, its mean curvature 0: r·r'' = 1 + r'².
  const a = .25, h = catenoidHeight(.5, a), r = y => a * Math.cosh(y / a), e = 1e-4;
  assert.ok(Math.abs(r(h) - .5) < 1e-9);
  for (const y of [-.2, 0, .1, .3]) { const d1 = (r(y + e) - r(y - e)) / (2 * e), d2 = (r(y + e) - 2 * r(y) + r(y - e)) / (e * e); assert.ok(Math.abs(r(y) * d2 - 1 - d1 * d1) < 1e-3); }
  assert.ok(closedShape('catenoid') && !closedShape('string'));
});

test('a string runs from one end to the other, its pulses flip over at each fixed end and the ends never move', () => {
  const grid = [400, 1, 1], size = { x: 1.2, y: 0, z: 0 };
  const first = latticeShape('string', latticeCell(grid, 0), size), last = latticeShape('string', latticeCell(grid, 399), size);
  assert.ok(first.x < -1.19 && last.x > 1.19 && first.y === 0 && last.z === 0, 'a straight line between its two ends');
  const L = 2.4, w = .16, from = 0;
  // Plucked in its middle towards its far end: up on the way there, upside down on the way back.
  const peak = (s) => { let best = 0, where = 0; for (let u = 0; u <= L; u += .005) { const y = stringPulse(u, L, from, 1, s, w); if (Math.abs(y) > Math.abs(best)) { best = y; where = u; } } return { best, where }; };
  // 1.2 m to the far end, then 0.8 m back from it.
  const going = peak(.6), coming = peak(2);
  assert.ok(going.best > .95 && Math.abs(going.where - 1.8) < .02, 'up, 0.6 m on from the middle');
  assert.ok(coming.best < -.95 && Math.abs(coming.where - 1.6) < .02, 'upside down, coming back');
  for (const s of [0, .3, 1.2, 1.9, 3.1, 4.4]) for (const end of [0, L]) assert.ok(Math.abs(stringPulse(end, L, from, 1, s, w)) < 1e-6, 'its ends stay put');
  const r = stringReflections(L, from, 1);
  assert.equal(r.first, 1.2); assert.equal(r.every, L);
  assert.equal(r.end(0), 1); assert.equal(r.end(1), -1);
  assert.ok(Math.abs(stringReflections(L, .5, -1).first - 1.8) < 1e-9, 'from three quarters along, back to the start');
  // Plucked towards the start, it mirrors the same.
  for (const u of [.2, .9, 1.7]) assert.ok(Math.abs(stringPulse(u, L, .3, -1, .7, w) - stringPulse(L - u, L, -.3, 1, .7, w)) < 1e-9);
});

test('the lattice presets are fight effects', () => {
  for (const name of ['ward', 'morph', 'current', 'veil', 'forge', 'shield', 'bubble', 'globe', 'orb', 'film', 'film-fade', 'string']) assert.ok(FIGHT_FX.includes(name), name);
});

test('thrown, a lattice is cut into wedges from straight behind: each side flies at the points on its side, in order', () => {
  // Three points ahead (facing 0, along +x), sorted by their angle: the left back third to the first,
  // the front third to the middle one, the right back third to the last.
  const facing = 0, at = deg => latticeAim(deg * Math.PI / 180, facing, 3);
  assert.equal(at(-170), 0); assert.equal(at(-90), 0);
  assert.equal(at(-30), 1); assert.equal(at(0), 1); assert.equal(at(30), 1);
  assert.equal(at(90), 2); assert.equal(at(170), 2);
  // Whatever way the points lie, the member straight ahead of the lattice goes to the middle one, and one point takes everyone.
  for (const turn of [-2.5, -1, .7, 3]) assert.equal(latticeAim(turn, turn, 3), 1);
  for (const angle of [-3, -1, 0, 2, 3.1]) assert.equal(latticeAim(angle, .4, 1), 0);
});
