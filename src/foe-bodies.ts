import type { FoeKind } from './battle';

/**
 * The foes whose body is a figure made with OpenAI and Meshy (`just character-3d <id>`, tools/figures.toml):
 * the creature file (src/creatures/<id>.json) each kind's template is built on (src/fears.ts,
 * src/cuerdas-foes.ts, src/camping-foes.ts, src/luca-foes.ts, src/modelo-foes.ts). The young of a fear wear its figure, smaller. Whatever
 * shows a rule (Lo Directo's lance, La Lealtad's knot, an Eco's rings) is still built on top in code.
 */
export const FOE_BODIES: Partial<Record<FoeKind, string>> = {
  cebollon: 'cebollon', cebolla: 'cebollon', cebollita: 'cebollon',
  plato: 'plato', platito: 'plato',
  fantasmita: 'fantasmita',
  lealtad: 'lealtad', eco: 'eco', directo: 'directo',
  mago: 'mago', agente: 'agente', campeon: 'campeon',
  polilla: 'polilla',
  atomo: 'atomo',
};
/**
 * Foes outside the castle who fight as a figure of `just character-3d` with Meshy's skeleton, loaded
 * and moved like the castle's pupils (src/castle-models.ts `foeFigure`): Fran as the boss of Luca's
 * mission (tools/figures.toml `[fran-jefe]`). His primitives (src/luca-foes.ts) stand in while it loads.
 */
export const BOSS_FIGURES: Partial<Record<FoeKind, string>> = { fran: 'fran-jefe' };
