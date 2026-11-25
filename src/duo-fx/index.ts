import type { DuoStagings } from './types';
import { staging as marea } from './marea';
import { staging as fulgurita } from './fulgurita';
import { staging as sucesoSeguro } from './suceso-seguro';
import { staging as metralla } from './metralla';
import { staging as ideaFija } from './idea-fija';
import { staging as caleidoscopio } from './caleidoscopio';
import { staging as geiser } from './geiser';
import { staging as aEscala } from './a-escala';
import { staging as seiche } from './seiche';
import { staging as staccato } from './staccato';
import { staging as cadaverExquisito } from './cadaver-exquisito';
import { staging as trampantojo } from './trampantojo';
import { staging as electrolisis } from './electrolisis';

/** The newer duals' own looks, each in its file (src/duo-fx/types.ts). One not here plays the shared staging. */
export const DUO_STAGINGS: DuoStagings = {
  'marea': marea,
  'fulgurita': fulgurita,
  'suceso-seguro': sucesoSeguro,
  'metralla': metralla,
  'idea-fija': ideaFija,
  'caleidoscopio': caleidoscopio,
  'geiser': geiser,
  'a-escala': aEscala,
  'seiche': seiche,
  'staccato': staccato,
  'cadaver-exquisito': cadaverExquisito,
  'trampantojo': trampantojo,
  'electrolisis': electrolisis,
};
export type { DuoFighter, DuoStage, DuoStaging } from './types';
