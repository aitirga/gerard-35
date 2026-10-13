/** Asks the game API (and its AI provider) where each dog pushes. Any failure keeps the built-in rule. */
import type { BattleState } from './battle';

export async function planEnemyTurn(state: BattleState, timeoutMs = 2500): Promise<Record<string, string>> {
  // Scripted fights (the palace minion) follow their own rule in battle.ts.
  if (state.encounter !== 'dogs' || state.allies.filter(a => a.hp > 0).length < 2) return {};
  try {
    const response = await fetch('/api/battle/enemy-turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        allies: state.allies.map(a => ({ id: a.id, hp: a.hp, max_hp: a.maxHp, guarding: a.guarding })),
        foes: state.foes.map(f => ({ id: f.id, hp: f.hp, max_hp: f.maxHp })),
      }),
    });
    return response.ok ? (await response.json()).targets ?? {} : {};
  } catch {
    return {};
  }
}
