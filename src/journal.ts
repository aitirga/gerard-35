/**
 * What the status screen says about the story: the time, what the day is about, and the diary.
 * None of it is an instruction (AGENTS.md, game philosophy): the mission is a vague line, the
 * diary is Gerard's (or Aitor's) memory of what happened and a thought he cannot shake, never a
 * place to go or a thing to do. Pure: no DOM, no engine.
 */
import type { MemberId, Story, StoryFlag } from './story';

export interface Chapter { kicker: string; title: string; entries: string[] }
/** `mission` is the one vague line on the first page; `thought` is the cryptic one in the diary. */
export interface Thought { mission: string; thought: string }

/**
 * Time moves with the story, not with real seconds (docs/chapter-2.md, The clock): each beat
 * sets the hour it happens at. Minutes since midnight.
 */
const CLOCK: [StoryFlag, number][] = [
  ['intro', 7 * 60 + 30], ['met-jan', 7 * 60 + 34], ['got-potion', 7 * 60 + 36], ['got-shoes', 7 * 60 + 42],
  ['got-backpack', 7 * 60 + 48], ['bernat-joined', 7 * 60 + 55], ['bernat-stalled', 8 * 60 + 2], ['dejavu', 8 * 60 + 4],
  ['minion', 8 * 60 + 5], ['first-fight', 8 * 60 + 11], ['palace', 8 * 60 + 13], ['in-palace', 8 * 60 + 20],
  ['got-chicle', 8 * 60 + 26], ['noista', 8 * 60 + 33], ['wrapper-room', 8 * 60 + 34],
  ['caught', 8 * 60], ['got-wrapper', 8 * 60 + 6],
];
export function storyClock(story: Story): { time: string; day: string } {
  let minutes = 7 * 60 + 30;
  for (const [flag, at] of CLOCK) if (story.has(flag)) minutes = at;
  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  // Chapter 1 is a childhood morning with no date; at 35 it is always the same birthday.
  return { time, day: story.adult ? 'JUE · 15 OCT' : 'DÍA DE COLE' };
}

/** What Gerard remembers, one line per beat, in the order they can happen. */
const GERARD_DIARY: { chapter: 1 | 2; flag: StoryFlag; text: string }[] = [
  { chapter: 1, flag: 'met-jan', text: 'Jan me felicitó medio dormido. Sabe más de lo que dice.' },
  { chapter: 1, flag: 'got-potion', text: 'Un frasco de la mesa de Jan: «POCIÓ. NO TOCAR». Lo toqué.' },
  { chapter: 1, flag: 'got-shoes', text: 'Mamá me regaló unas zapatillas. Ahora nadie me alcanza.' },
  { chapter: 1, flag: 'got-backpack', text: 'Libros, estuche y un bocadillo de fuet.' },
  { chapter: 1, flag: 'bernat-joined', text: 'Bernat bajó tarde, como siempre. Dice que hoy tiene una sensación rara.' },
  { chapter: 1, flag: 'dejavu', text: 'Bernat jura que todo esto ya lo había soñado. Igualito.' },
  { chapter: 1, flag: 'minion', text: 'Algo rosa salió de la alcantarilla. Los perros tenían sus ojos.' },
  { chapter: 1, flag: 'first-fight', text: 'Ganamos a los perros. El cielo se volvió rosa.' },
  { chapter: 1, flag: 'palace', text: 'Al final del pasaje creció un palacio de chicle.' },
  { chapter: 1, flag: 'in-palace', text: 'Atravesamos la pompa. Pegajosa, pero se atraviesa.' },
  { chapter: 1, flag: 'got-chicle', text: 'Un chicle de fresa para el camino. Sabe a fresa… casi.' },
  { chapter: 1, flag: 'noista', text: 'Dije que no. Y el mundo me hizo caso.' },
  { chapter: 1, flag: 'caught', text: 'Unas manos de gelatina. Luego, todo negro.' },
  { chapter: 2, flag: 'caught', text: 'Me desperté gritando «¡NO!». Treinta y cinco años. Barcelona.' },
  { chapter: 2, flag: 'got-wrapper', text: 'En la mesilla, un envoltorio de Bubbaloo. Del sueño. Huele a fresa.' },
];
/** Aitor was not in the dream: his diary starts the morning Gerard wakes up. */
const AITOR_DIARY: { flag: StoryFlag; text: string }[] = [
  { flag: 'caught', text: 'Gerard se despertó gritando «¡NO!». Feliz cumpleaños, supongo.' },
  { flag: 'got-wrapper', text: 'Me enseñó un envoltorio de chicle como si fuera una prueba de algo.' },
];
const CHAPTERS = {
  1: { kicker: 'CAPÍTULO 1 · SANT QUIRZE', title: 'Una mañana de otoño' },
  2: { kicker: 'CAPÍTULO 2 · BARCELONA', title: 'El día que se repite' },
} as const;

/** The diary, current chapter first. */
export function diary(story: Story, member: MemberId = 'gerard'): Chapter[] {
  if (member === 'aitor') return [{ ...CHAPTERS[2], entries: AITOR_DIARY.filter(e => story.has(e.flag)).map(e => e.text) }];
  const chapter = (n: 1 | 2): Chapter => ({ ...CHAPTERS[n], entries: GERARD_DIARY.filter(e => e.chapter === n && story.has(e.flag)).map(e => e.text) });
  return story.adult ? [chapter(2), chapter(1)] : [chapter(1)];
}

/** What the day is about right now, said vaguely, and the thought that goes round Gerard's head. */
export function currentThought(story: Story, member: MemberId = 'gerard'): Thought {
  const has = (flag: StoryFlag) => story.has(flag);
  if (member === 'aitor') return has('got-wrapper')
    ? { mission: 'Estar a su lado.', thought: 'Dice que ha soñado con un palacio de chicle. Lo dice muy en serio. Habrá que escucharle… con un café delante.' }
    : { mission: 'Que tenga un buen cumpleaños.', thought: 'Treinta y cinco. Se ha despertado como si le persiguiera algo. Mejor no perderle de vista hoy.' };
  if (story.adult) return has('got-wrapper')
    ? { mission: 'Entender qué está pasando.', thought: 'Si fue un sueño, ¿por qué huele a fresa? Las cosas de los sueños no deberían quedarse en la mesilla.' }
    : { mission: 'Despertar del todo.', thought: 'El sueño se ha ido, pero algo se ha quedado cerca de la cama. Lo noto.' };
  if (has('wrapper-room')) return { mission: 'Salir de aquí.', thought: 'Rosa. Manos. Rosa.' };
  if (has('in-palace')) return { mission: 'Salir del palacio.', thought: 'Cada sala tiene un nombre escrito. La pompa no deja salir a quien no ha terminado lo que vino a hacer. Y algo gorgotea en algún sitio.' };
  if (has('first-fight')) return { mission: 'Entender qué ha pasado.', thought: 'Al fondo de la calle hay algo que esta mañana no estaba. Bernat lo había dibujado. ¿Y si se entra como en su sueño?' };
  if (has('minion')) return { mission: 'Defendernos.', thought: 'Unos ojos rosas que no son de perro.' };
  if (story.companion === 'stalled') return { mission: 'Llegar al cole.', thought: 'Bernat se ha quedado clavado. Tiene cara de haber olvidado algo… o de recordarlo.' };
  if (has('bernat-joined')) return { mission: 'Llegar al cole.', thought: 'Todo está en su sitio: la calle, los perros, la alcantarilla. Quizá demasiado en su sitio.' };
  if (has('got-backpack')) return { mission: 'Ir al cole.', thought: 'Nunca voy solo al cole. Hay alguien que siempre llega tarde, y no soy yo.' };
  if (has('got-shoes')) return { mission: 'Prepararme para el cole.', thought: 'Los pies ya están listos. La espalda todavía pesa poco.' };
  return { mission: 'Empezar el día.', thought: 'Huele a tostadas. Alguien en esta casa sabe qué día es hoy.' };
}
