import type { createGame } from './game';
import type { createBattleUI } from './battle-ui';
import type { DualId, SkillId } from './battle';
import { REACTIONS, STATUS_LOOKS, type ReactionId, type StatusLookId } from './status-fx';

type Game = Awaited<ReturnType<typeof createGame>>;
type BattleUI = ReturnType<typeof createBattleUI>;
/** What the stage can be asked to play: a skill or a dual of the party, a status or a reaction on a foe. */
export type DemoMove = { skill: SkillId } | { dual: DualId } | { status: StatusLookId } | { reaction: ReactionId };

/**
 * Development: the ánimas' sheet's stage (`/?anima-demo`, docs/dev-tools.md § The ánimas' sheet).
 * The game in a frame of the sheet, in a fight that never ends (Gerard at 35 and Aitor against three
 * dogs), where the sheet asks for one thing at a time through `window.animaDemo`: a skill or a dual
 * played by the fight's own rules as the fight shows it (`battleUI.demo`), or a status or a reaction
 * drawn on the middle dog as the effects lab draws them (src/fx-lab.ts). Nothing is saved.
 */
export function mountAnimaDemo(game: Game, battleUI: BattleUI, audio: { tryStart(): void }) {
  document.documentElement.dataset.animaDemo = '';
  const style = document.createElement('style');
  // Only the fight and what it shows of a move (banners, callouts, numbers, the party's plates): no
  // commands, title or picker button, which nobody uses here.
  style.textContent = '[data-anima-demo] :is(.jump-fight, .battle-dock, .battle-heading, .dev-badge) { display: none !important; }';
  document.head.append(style);
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** The middle foe, where statuses and reactions are drawn. */
  const foe = () => { const foes = game.fighterIds().filter(f => !f.party); return foes[Math.floor((foes.length - 1) / 2)]?.id; };
  /** Takes every status off everyone, so the next one is seen alone. */
  function clean() {
    clearTimeout(timer);
    for (const f of game.fighterIds()) { game.ignite(f.id); for (const look of Object.keys(STATUS_LOOKS) as StatusLookId[]) game.status(f.id, look, 0); }
  }
  const api = {
    /** Whether a move can be played now: the fight is open, on the party's turn and still. */
    ready: () => { const fight = battleUI.fight; return !!fight && fight.phase === 'player' && !fight.busy; },
    async play(move: DemoMove): Promise<{ ok: boolean; text: string }> {
      audio.tryStart();
      if (!api.ready()) return { ok: false, text: 'Espera: el combate aún se mueve.' };
      game.effects.clear(); game.frame();
      if ('skill' in move || 'dual' in move) { clean(); return battleUI.demo(move); }
      const id = foe();
      if (!id) return { ok: false, text: 'No hay enemigo.' };
      clean();
      if ('status' in move) {
        const look = STATUS_LOOKS[move.status];
        if (!look) return { ok: false, text: `No hay estado ${move.status}.` };
        // Quemado is the fire itself: it burns at its middle level, as Hoguera does.
        if (look.fire) game.ignite(id, 'medium');
        game.status(id, move.status, look.fire ? 2 : 3, 30);
        return { ok: true, text: `${look.name} en ${id}` };
      }
      const reaction = REACTIONS[move.reaction];
      if (!reaction) return { ok: false, text: `No hay reacción ${move.reaction}.` };
      // A reaction needs its status on them first: it is put on, then the element turns it.
      game.status(id, reaction.status, 2, 30);
      timer = setTimeout(() => game.react(move.reaction, id), 700);
      return { ok: true, text: `${reaction.name}: ${STATUS_LOOKS[reaction.status].name} + ${reaction.element}` };
    },
    clean,
  };
  (window as unknown as { animaDemo: typeof api }).animaDemo = api;
  return { destroy() { clean(); style.remove(); delete document.documentElement.dataset.animaDemo; delete (window as unknown as { animaDemo?: unknown }).animaDemo; } };
}
