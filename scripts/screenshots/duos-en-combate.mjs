// Scene fixtures for duos-en-combate.json. Choose the move and its target on the regular fight menu.
export function prepare(id) {
  const { game, battleUI } = window.gerard;
  const beats = new Map(), began = new Set();
  const keyOf = effect => effect.detonation ? 'detonation' : effect.dual?.id ?? effect.kind;
  const setBattle = game.setBattle.bind(game);
  game.setBattle = (state, effect, onImpact) => {
    // The scene starts the move here, once its unlock (if any) is over: the clip starts with it.
    if (effect) began.add(keyOf(effect));
    // A blast starts between turns, on its own: the clock holds until its clip's first frame lets it go (`each` in the scenario).
    if (effect?.detonation) game.app.timeScale = 0;
    return setBattle(state, effect, onImpact && (blow => {
      if (!blow && effect) beats.set(keyOf(effect), effect);
      onImpact(blow);
    }));
  };
  document.querySelector('.battle-dock[data-dock="1"] [data-command="dual"] .command-trigger').click();
  return {
    /** Whether the move (`key`, the dual by default) has started on the scene. */
    began(key = id) { return began.has(key); },
    /** Confirms the dual on its target: Gerard for the party's, else the foe at `foe` in the row (the first by default). */
    confirm(foe = 0) {
      const s = battleUI.live;
      // The duals that are for the party (a cure, a boost, a dome, a cortina) are aimed at Gerard.
      const ally = ['sutura-de-luz', 'suceso-seguro', 'caleidoscopio', 'trampantojo'].includes(id);
      const target = ally ? 'gerard' : (s.foes[foe] ?? s.foes[0]).id;
      const selector = ally ? '.roster-target' : '.battle-target';
      const button = document.querySelector(`${selector}[data-target="${target}"]:not(:disabled)`);
      if (!button) throw new Error(`Target unavailable for ${id}: ${target}`);
      // The opening still shows the ordinary framing. Get close enough in the clip to read the stitches and pigment.
      // Sobrecalentamiento's dome stands over the party and its bits fly to the foes: both in the frame.
      const wide = id === 'sobrecalentamiento' || (ally && id !== 'sutura-de-luz');
      const points = (id === 'sutura-de-luz' ? [target] : wide ? [...s.allies, ...s.foes].map(f => f.id) : s.foes.map(f => f.id)).map(unit => game.fighterAt(unit));
      const mean = key => points.reduce((sum, p) => sum + p[key], 0) / points.length;
      const orbital = id === 'bombardeo-orbital';
      game.frame({ x: mean('x'), y: mean('y') + (orbital ? 2 : 1), z: mean('z') }, orbital ? 3.25 : id === 'sutura-de-luz' ? 2.05 : wide ? 4.4 : 2.6);
      button.click();
    },
    async impact(key = id) {
      const start = performance.now();
      while (!beats.has(key)) {
        if (performance.now() - start > 60000) throw new Error(`No impact for ${id} (${key})`);
        await new Promise(requestAnimationFrame);
      }
      const effect = beats.get(key);
      if (id === 'relevo-de-sangre' && effect.relay?.stacks !== 3) throw new Error('The wound did not transfer');
      if (key === 'detonation' && !effect.hits.some(hit => hit.amount > 0)) throw new Error('No foe took damage');
    },
  };
}
