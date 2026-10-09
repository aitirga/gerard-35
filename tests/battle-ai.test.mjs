import test from 'node:test';
import assert from 'node:assert/strict';
import { planEnemyTurn } from '../src/battle-ai.ts';
import { createBattle, act, enemyAct, nextRound } from '../src/battle.ts';

const withFetch = async (fake, run) => {
  const original = globalThis.fetch; globalThis.fetch = fake;
  try { return await run(); } finally { globalThis.fetch = original; }
};

test('without Jev (no key, no backend, errors or timeouts) battles keep the built-in rule', async () => {
  const unavailable = [
    async () => new Response('{"detail":"Battle AI is not configured"}', { status: 503 }),
    async () => new Response('', { status: 502 }),
    async () => { throw new TypeError('Failed to fetch'); },
    // A server that never answers; the ref'd timer keeps Node alive until the abort fires.
    (_url, { signal }) => new Promise((_, reject) => {
      const hang = setTimeout(() => {}, 1000);
      signal.addEventListener('abort', () => { clearTimeout(hang); reject(signal.reason); });
    }),
  ];
  for (const fake of unavailable) {
    const s = createBattle(2, 2); act(s, 'defend'); act(s, 'defend');
    const plan = await withFetch(fake, () => planEnemyTurn(s, 20));
    assert.deepEqual(plan, {});
    assert.deepEqual(s.foes.map(f => enemyAct(s, f.id, plan[f.id]).target), ['gerard', 'bernat']);
    nextRound(s); assert.equal(s.phase, 'player'); assert.equal(s.round, 2);
  }
});

test('solo battles never call the API', async () => {
  const s = createBattle(1, 3); act(s, 'defend');
  await withFetch(() => assert.fail('fetch should not run'), async () => assert.deepEqual(await planEnemyTurn(s), {}));
});
