/**
 * The choir's room inside (docs/quests/coro.md § The room inside): where the people Gerard and Aitor
 * sent there stand, and what they say there. `src/story.ts` decides who is in (`choirNpcs`); this
 * file is data only, as the one-file-per-friend convention asks. The cells come from the room's
 * plan (`CORO` in src/environments.ts): the aisles between the rows of chairs.
 *
 * Every mission ends with Gerard asking them to come here whatever happens (`coro` in each friend's
 * lines); from the morning after, they do. Nobody knows why, and nobody here says it: they turned up,
 * the way you turn up to a rehearsal. Each group speaks in its own language, as everywhere else.
 * Fran (Luca's mission) was never asked and comes all the same, the same morning as Luca.
 */
import type { Dialogue, DialogueLine, SpeakerId } from '../dialogue';
import type { EnvironmentId } from '../environments';
import type { Cell } from '../movement';
import type { UniFriend } from './universidad.ts';

export const CORO_PLACE: EnvironmentId = 'coro';

/** Who comes here, by the mission that sent them; each group's flag is set the morning after it is won (`gather` in src/story.ts). */
export type ChoirGroup = 'nuria' | 'uni' | 'marta' | 'emilie' | 'luca';
export type ChoirPerson = 'nuria' | 'uri' | 'marta' | 'emilie' | 'luca' | 'fran' | UniFriend;

export const PLACES_CORO = {
  /** Just inside the shutter, coming in from the avenue. */
  spawn: { x: 7, z: 11 },
  /** The director's stand at the front, facing the rows: Ensayar is played from here. */
  stand: { x: 7, z: 9 },
  /** Where each one stands among the rows, facing the stand (+z). Groups keep together. */
  people: {
    nuria: { x: 4, z: 4 }, uri: { x: 5, z: 4 },
    anna: { x: 3, z: 2 }, alvaro: { x: 4, z: 2 }, miquel: { x: 10, z: 2 }, sarah: { x: 11, z: 2 },
    soraya: { x: 10, z: 4 }, nico: { x: 11, z: 4 }, joan: { x: 12, z: 4 },
    marta: { x: 4, z: 6 },
    emilie: { x: 10, z: 6 },
    luca: { x: 11, z: 8 },
    // Fran, freed in Luca's mission, apart from him at the end of a row: nobody sent him, and he came.
    fran: { x: 13, z: 6 },
  } satisfies Record<ChoirPerson, Cell>,
} as const;

/** Each one's group, for who answers when one of them is spoken to. */
export const CHOIR_GROUPS: Record<ChoirPerson, ChoirGroup> = {
  nuria: 'nuria', uri: 'nuria',
  anna: 'uni', alvaro: 'uni', miquel: 'uni', sarah: 'uni', soraya: 'uni', nico: 'uni', joan: 'uni',
  marta: 'marta', emilie: 'emilie', luca: 'luca', fran: 'luca',
};
/** Their names, for the prompt to speak to them (as in SPEAKERS, src/dialogue.ts). */
export const CHOIR_NAMES: Record<ChoirPerson, string> = {
  nuria: 'Nuria', uri: 'Uri', anna: 'Anna', alvaro: 'Álvaro', miquel: 'Miquel', sarah: 'Sarah', soraya: 'Soraya', nico: 'Nico', joan: 'Joan',
  marta: 'Marta', emilie: 'Emilie', luca: 'Luca', fran: 'Fran',
};
/** The order they are drawn and listed in. */
export const CHOIR_PEOPLE = Object.keys(CHOIR_GROUPS) as ChoirPerson[];

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const line = (speaker: SpeakerId, text: string): DialogueLine => ({ speaker, text });
const group = (right: SpeakerId, ...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right, lines });
const both = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'aitor', lines });

export const LINES_CORO = {
  /** Spoken to in the room: one exchange per group, whoever of them is addressed. */
  talk: {
    nuria: group('nuria',
      line('nuria', 'Hem agafat el tren sense pensar-hi. Com qui va a la feina.'),
      line('uri', 'I el Nil s\'ha adormit al primer acord.'),
      aitor('Eso es que afinamos.'),
    ),
    uni: group('miquel',
      line('miquel', 'Els nens, amb els avis. No sé ni què els hem dit.'),
      line('soraya', 'Jo no canto. Però aquí estic.'),
      line('joan', 'Do. Ara sí que surt.'),
      gerard('Quedeu-vos. Hi ha lloc.'),
    ),
    marta: group('marta',
      line('marta', 'He venido desde Alegia sin pensarlo mucho. Me siento donde haga falta una voz.'),
      aitor('Aquí siempre hace falta una.'),
    ),
    emilie: group('emilie',
      line('emilie', 'No sé por qué he venido hoy.'),
      line('emilie', 'Y por primera vez en días no me hace falta saberlo.'),
    ),
    luca: group('luca',
      line('luca', 'Aquí dins no hi ha ni un color que em sobri. M\'agrada.'),
      gerard('Doncs no et moguis.'),
    ),
  } satisfies Record<ChoirGroup, Dialogue>,
  /** Who answers for themselves rather than with their group: Fran, who came with Luca's people but was never asked. */
  own: {
    fran: group('fran',
      line('fran', 'Nadie me dijo que viniera. Y aquí estoy.'),
      line('fran', 'Lo último que recuerdo es una capa que no era mía.'),
      aitor('Siéntate donde quieras. Aquí nadie te va a pedir nada.'),
    ),
  } satisfies Partial<Record<ChoirPerson, Dialogue>>,
  /** Their own places, once they come here instead: Emilie's door, and the piano in Alegia without Marta. */
  emilieDoor: both(aitor('Nadie contesta.')),
  pianoAlone: both(aitor('Sin Marta, esta pieza se queda a medias.')),
};
