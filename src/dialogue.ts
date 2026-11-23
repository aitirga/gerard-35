// Conversation banner: who is talking, to whom, and what they say.
// Tweak looks in style.css (#dialogue custom properties) and voices here.
import PORTRAIT_EXPRESSIONS from './portraits.json';

export interface Speaker {
  name: string;
  /** Portrait in public/portraits/ without .png; low-poly painting made with `just character` (never from the 3D figure). */
  portrait?: string;
  skin: string;
  hair: string;
  top: string;     // jacket / sweater colour, also used as the avatar tint
  accent: string;  // ring + name colour while speaking
}

export const SPEAKERS = {
  gerard: { name: 'Gerard', portrait: 'gerard-child', skin: '#e6b58b', hair: '#342a28', top: '#e9ad48', accent: '#f0c46a' },
  bernat: { name: 'Bernat', portrait: 'bernat-child', skin: '#dcb08a', hair: '#5b4636', top: '#6f8fa8', accent: '#9fc3d9' },
  mama: { name: 'Mamá', portrait: 'mama', skin: '#e8bc96', hair: '#6b4a32', top: '#b5645a', accent: '#e9a294' },
  jan: { name: 'Jan', portrait: 'jan-child', skin: '#e6b58b', hair: '#2b2220', top: '#2a2828', accent: '#e8742c' },
  /** Chapter 2: Gerard at 35. */
  gerard35: { name: 'Gerard', portrait: 'gerard-adult', skin: '#e6b58b', hair: '#342a28', top: '#5f6b45', accent: '#f0c46a' },
  /** Gerard's partner. */
  aitor: { name: 'Aitor', portrait: 'aitor', skin: '#dcae8a', hair: '#2a2424', top: '#2d3a55', accent: '#e7c9a1' },
  /** Nuria (docs/quests/nuria.md). */
  nuria: { name: 'Nuria', portrait: 'nuria', skin: '#e9bf9c', hair: '#3b2a22', top: '#f1e8da', accent: '#c8423b' },
  /** Uri (docs/quests/nuria.md); `crio` is his face while the Queen holds him. */
  uri: { name: 'Uri', portrait: 'uri', skin: '#e3b38f', hair: '#2e2420', top: '#f5f3ef', accent: '#9a6cd8' },
  /**
   * The university friends (docs/quests/universidad.md), portraits from `just character`: the accent
   * is their light while the Queen holds them, her violet for all.
   */
  alvaro: { name: 'Álvaro', portrait: 'alvaro', skin: '#e2b48e', hair: '#4a3324', top: '#5d6b4a', accent: '#b07aff' },
  anna: { name: 'Anna', portrait: 'anna', skin: '#ecc3a0', hair: '#7a3f2a', top: '#f1ece2', accent: '#b07aff' },
  miquel: { name: 'Miquel', portrait: 'miquel', skin: '#e3b591', hair: '#4b3426', top: '#4c5d6e', accent: '#b07aff' },
  sarah: { name: 'Sarah', portrait: 'sarah', skin: '#efc9a8', hair: '#8a4a30', top: '#7d8fa3', accent: '#b07aff' },
  soraya: { name: 'Soraya', portrait: 'soraya', skin: '#e0b089', hair: '#231a17', top: '#2e2e33', accent: '#b07aff' },
  nico: { name: 'Nico', portrait: 'nico', skin: '#e6b892', hair: '#2a1e18', top: '#3c3f44', accent: '#b07aff' },
  joan: { name: 'Joan', portrait: 'joan', skin: '#e4b48d', hair: '#22181a', top: '#4a4350', accent: '#b07aff' },
  /** Marta (docs/quests/marta.md), portrait from `just character`; the accent is the note Do of her song. */
  marta: { name: 'Marta', portrait: 'marta', skin: '#ecbf98', hair: '#d9b46a', top: '#3d3c40', accent: '#49d3c2' },
  /** Emilie (docs/quests/emilie.md), portrait from `just character`: her black jacket and crimson scarf. */
  emilie: { name: 'Emilie', portrait: 'emilie', skin: '#ecc4a2', hair: '#5a3620', top: '#212023', accent: '#3fe07a' },
  /** Luca (docs/quests/luca.md), portrait from `just character`: his loud colours, which the Queen's hold takes out of him. */
  luca: { name: 'Luca', portrait: 'luca', skin: '#e4b18c', hair: '#3a2c24', top: '#f08a2c', accent: '#2f8f7a' },
  /** Fran, Luca's partner, under the Queen's hold: black and white, cold. */
  fran: { name: 'Fran', portrait: 'fran', skin: '#e2b896', hair: '#1d1a1a', top: '#1c1c20', accent: '#d9dde4' },
  /** The chaplains Fran has restyled in the Sagrada Família. */
  capellan: { name: 'Capellán', portrait: 'capellan', skin: '#dcb594', hair: '#3e7fc4', top: '#18181c', accent: '#e9e6dc' },
  /** The campsite's foes (docs/quests/universidad.md § Càmping Eurocamping), for the word each of them shouts as it falls in a fight; portraits from `just character`, of their figures (tools/figures.toml). */
  mago: { name: 'Mago de camping', portrait: 'mago', skin: '#c9b89a', hair: '#3a3428', top: '#7d7a5a', accent: '#e8b04a' },
  agente: { name: 'Agente', portrait: 'agente', skin: '#d8cfb8', hair: '#2a2622', top: '#c9bfa4', accent: '#e8b04a' },
  /**
   * The castle (docs/castle-bosses.md): Aurelià and the management team, her violet for accent while she
   * holds them; the Queen, in the face she took (Nuria Mendoza's, the false lead: docs/lore.md); and
   * Bernat at 35, on the phone. Only the Queen has a portrait yet: the others' drawn faces take their
   * figures' colours (tools/figures.toml: Aurelià tanned and dark-haired in his white vest; Mar's dark
   * bun and grey coat, Montse's grey bob and manila cardigan, Pilar's pale hair and steel-blue dress).
   */
  aurelia: { name: 'Aurelià', skin: '#c48f62', hair: '#4a2f22', top: '#d8c39b', accent: '#b07aff' },
  mar: { name: 'Mar', portrait: 'mar', skin: '#e6bb98', hair: '#7a3a22', top: '#4a4d55', accent: '#b07aff' },
  montse: { name: 'Montse', portrait: 'montse', skin: '#e2b48e', hair: '#b59f7e', top: '#c9b48a', accent: '#b07aff' },
  pilar: { name: 'Pilar', portrait: 'pilar', skin: '#d6a57c', hair: '#3b2a20', top: '#5a6a82', accent: '#b07aff' },
  reina: { name: 'La Reina Bubbaloo', portrait: 'reina', skin: '#f2a8c8', hair: '#e86aa6', top: '#c8306e', accent: '#ff6fae' },
  bernat35: { name: 'Bernat', skin: '#dcb08a', hair: '#5b4636', top: '#4a5560', accent: '#9fc3d9' },
} satisfies Record<string, Speaker>;

export type SpeakerId = keyof typeof SPEAKERS;
/** `expression` picks e.g. portraits/gerard-child-sorprendido.png; lines without one, or with one not generated yet, use the plain portrait. */
/**
 * `pace` changes how a line comes out: `rambling` lines (someone who does not stop talking) run into
 * the next with no pause, and each press cuts the sentence off; after a few presses they give up.
 * `spooky` types slowly with trembling letters.
 */
export interface DialogueLine { speaker: SpeakerId; text: string; expression?: string; pace?: 'rambling' | 'spooky' }
export interface Dialogue {
  left: SpeakerId;      // Gerard, normally
  right?: SpeakerId;    // whoever he is talking to, if anyone
  lines: DialogueLine[];
}

/** Who talks from Gerard's side when they are not the one on it. */
const PARTY = new Set<SpeakerId>(['gerard', 'gerard35', 'bernat', 'aitor']);

const TYPE_SPEED_MS = 0;       // per character; 0 shows ordinary lines at once (rambling and spooky lines still type)
const AUTO_ADVANCE_MS = 0;     // after a line finishes typing; 0 waits for the player's press (only rambling lines run on)
const RAMBLING_TYPE_MS = 13;   // a rambling speaker talks fast…
const RAMBLING_ADVANCE_MS = 450;  // …and barely stops between sentences
const RAMBLING_CUT_MS = 380;   // how long a cut-off sentence stays, with its dash
const RAMBLING_GIVE_UP = 3;    // presses over a rambling speaker before they stop
const SPOOKY_TYPE_MS = 70;

const EXPRESSIONS: Record<string, string[] | undefined> = PORTRAIT_EXPRESSIONS;

function portraitUrl(portrait: string, expression?: string) {
  const available = !expression || EXPRESSIONS[portrait]?.includes(expression);
  if (!available && import.meta.env.DEV) console.warn(`No "${expression}" expression for ${portrait}; run just character to create it.`);
  return `${import.meta.env.BASE_URL}portraits/${portrait}${available && expression ? `-${expression}` : ''}.png`;
}

// Blocky bust that echoes the in-game character: shoulders, neck, head, hair cap.
function portrait(s: Speaker) {
  if (s.portrait) return `<img class="portrait" src="${portraitUrl(s.portrait)}" alt="" aria-hidden="true" width="160" height="160" />`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="23" fill="${s.top}" opacity=".18"/>
    <rect x="11" y="31" width="26" height="17" rx="4" fill="${s.top}"/>
    <rect x="21" y="26" width="6" height="7" fill="${s.skin}"/>
    <rect x="15" y="11" width="18" height="17" rx="3" fill="${s.skin}"/>
    <path d="M15 17V13a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4H31l-2-3H19l-2 3Z" fill="${s.hair}"/>
    <rect x="19" y="20" width="2" height="2" fill="${s.hair}"/><rect x="27" y="20" width="2" height="2" fill="${s.hair}"/>
  </svg>`;
}

export function createDialogueBanner(hud: HTMLElement) {
  const root = document.createElement('section');
  root.id = 'dialogue';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <figure class="side left"><figcaption></figcaption></figure>
    <div class="speech"><span class="who"></span><p class="text"></p><span class="dots"></span></div>
    <figure class="side right"><figcaption></figcaption></figure>
    <button class="next" type="button"><span>Continuar</span><kbd data-glyph="interact">E</kbd></button>`;
  hud.append(root);
  const sides = { left: root.querySelector<HTMLElement>('.left')!, right: root.querySelector<HTMLElement>('.right')! };
  const who = root.querySelector<HTMLElement>('.who')!;
  const text = root.querySelector<HTMLElement>('.text')!;
  const dots = root.querySelector<HTMLElement>('.dots')!;
  const next = root.querySelector<HTMLButtonElement>('.next')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let current: Dialogue | undefined;
  let index = 0;
  let typing: ReturnType<typeof setInterval> | undefined;
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;
  let fullText = '';
  let shown = 0;
  /** Presses over the rambling speaker in this conversation, and whether a cut-off sentence is on screen. */
  let cuts = 0;
  let cutting = false;
  let letters: HTMLElement[] = [];
  let done: (() => void) | undefined;
  /** Who is speaking, with what face, and whether their line is still coming out; nothing when it closes. */
  let onSpeak: ((line?: DialogueLine, talking?: boolean) => void) | undefined;

  /** Who each side shows now: in a conversation with many, the side changes face and name with the speaker. */
  const onSide: Record<'left' | 'right', SpeakerId | undefined> = { left: undefined, right: undefined };
  function renderSide(slot: 'left' | 'right', id: SpeakerId | undefined) {
    const el = sides[slot];
    onSide[slot] = id;
    el.hidden = !id;
    if (!id) return;
    const s = SPEAKERS[id];
    el.style.setProperty('--accent', s.accent);
    el.querySelector('figcaption')!.textContent = s.name;
    el.querySelector('svg, img')?.remove();
    el.insertAdjacentHTML('afterbegin', portrait(s));
  }
  function stopTimers() { clearInterval(typing); clearTimeout(advanceTimer); typing = advanceTimer = undefined; cutting = false; }
  const pace = () => current?.lines[index].pace;
  function reveal(count: number) {
    if (pace() === 'spooky') letters.slice(0, count).forEach(l => l.classList.add('on'));
    else text.textContent = fullText.slice(0, count);
  }
  function finishLine() {
    stopTimers();
    shown = fullText.length;
    reveal(shown);
    root.dataset.typing = 'false';
    if (current) onSpeak?.(current.lines[index], false);
    const wait = pace() === 'rambling' ? RAMBLING_ADVANCE_MS : AUTO_ADVANCE_MS;
    if (wait) advanceTimer = setTimeout(() => goTo(index + 1), wait);
  }
  function goTo(next: number) {
    if (!current) return;
    if (next < current.lines.length) { index = next; showLine(); } else close();
  }
  /** A press over someone who will not stop: the sentence breaks off and they go on, until they give up. */
  function cutOff() {
    if (!current) return;
    const wasTyping = !!typing;
    stopTimers();
    if (wasTyping) text.textContent = `${fullText.slice(0, shown).trimEnd()}—`;
    root.dataset.typing = 'false';
    onSpeak?.(current.lines[index], false);
    let next = index + 1;
    if (++cuts >= RAMBLING_GIVE_UP) while (next < current.lines.length && current.lines[next].pace === 'rambling') next++;
    cutting = true;
    advanceTimer = setTimeout(() => { cutting = false; goTo(next); }, RAMBLING_CUT_MS);
  }
  function showLine() {
    if (!current) return;
    const line = current.lines[index];
    // Gerard's side is the party's; anyone else talks from the other side (a group: one after another).
    const side = line.speaker === current.left ? 'left' : line.speaker === current.right || !PARTY.has(line.speaker) ? 'right' : 'left';
    // Whoever speaks owns their side's name and face, Gerard too when he speaks again after Aitor.
    if (onSide[side] !== line.speaker) renderSide(side, line.speaker);
    root.dataset.speaking = side;
    // The speaker's face follows each line; the listener keeps the last one.
    const face = sides[side].querySelector('img');
    const speaker: Speaker = SPEAKERS[line.speaker];
    if (face && speaker.portrait) face.src = portraitUrl(speaker.portrait, line.expression);
    who.textContent = SPEAKERS[line.speaker].name;
    dots.innerHTML = current.lines.map((_, i) => `<i${i === index ? ' class="on"' : ''}></i>`).join('');
    next.querySelector('span')!.textContent = index === current.lines.length - 1 ? 'Cerrar' : 'Continuar';
    fullText = line.text;
    stopTimers();
    onSpeak?.(line, true);
    if (line.pace) root.dataset.pace = line.pace; else delete root.dataset.pace;
    letters = [];
    if (line.pace === 'spooky') {
      // Words stay whole when the line wraps; each letter trembles on its own.
      text.replaceChildren(...line.text.split(/(\s+)/).map(part => {
        if (/^\s+$/.test(part) || !part) return document.createTextNode(part);
        const word = document.createElement('span');
        word.className = 'word';
        for (const ch of part) {
          const letter = document.createElement('span');
          letter.textContent = ch;
          letter.style.setProperty('--i', String(letters.length));
          letters.push(letter);
          word.append(letter);
        }
        return word;
      }));
      fullText = letters.map(l => l.textContent).join('');
    }
    shown = 0;
    if ((!TYPE_SPEED_MS && !line.pace) || reducedMotion.matches) { finishLine(); return; }
    if (line.pace !== 'spooky') text.textContent = '';
    root.dataset.typing = 'true';
    const speed = line.pace === 'rambling' ? RAMBLING_TYPE_MS : line.pace === 'spooky' ? SPOOKY_TYPE_MS : TYPE_SPEED_MS;
    typing = setInterval(() => {
      shown++;
      reveal(shown);
      if (shown >= fullText.length) finishLine();
    }, speed);
  }
  /** `onDone` runs once the conversation closes, however it closes (or another one replaces it). */
  function show(dialogue: Dialogue, onDone?: () => void) {
    if (!dialogue.lines.length) { onDone?.(); return; }
    const previous = done;
    done = onDone;
    previous?.();
    current = dialogue;
    index = 0;
    cuts = 0;
    for (const line of dialogue.lines) {  // warm the cache so faces change without a blank frame
      const speaker: Speaker = SPEAKERS[line.speaker];
      if (line.expression && speaker.portrait && EXPRESSIONS[speaker.portrait]?.includes(line.expression)) {
        new Image().src = portraitUrl(speaker.portrait, line.expression);
      }
    }
    renderSide('left', dialogue.left);
    renderSide('right', dialogue.right);
    root.hidden = false;
    hud.dataset.dialogue = 'open';
    showLine();
  }
  function advance() {
    if (!current) return;
    if (cutting) return;
    if (pace() === 'rambling') { cutOff(); return; }
    if (typing) { finishLine(); return; }  // first press reveals the whole line
    goTo(index + 1);
  }
  function close() {
    stopTimers();
    current = undefined;
    root.hidden = true;
    delete hud.dataset.dialogue;
    onSpeak?.();
    const finished = done;
    done = undefined;
    finished?.();
  }

  next.addEventListener('click', advance);
  // Runs before the game's own key handler, so E / Enter / Space advance instead of re-ringing the bell.
  window.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (!current || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) advance();
    } else if (event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) close(); }
  }, { capture: true });

  return { show, advance, close, get open() { return !!current; }, set onSpeak(listen: typeof onSpeak) { onSpeak = listen; } };
}
