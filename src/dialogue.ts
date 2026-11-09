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
  /** The campsite's foes (docs/quests/universidad.md § Càmping Eurosport), for the word each of them shouts as it falls in a fight; no portrait. */
  mago: { name: 'Mago de camping', skin: '#c9b89a', hair: '#3a3428', top: '#7d7a5a', accent: '#e8b04a' },
  agente: { name: 'Agente', skin: '#d8cfb8', hair: '#2a2622', top: '#c9bfa4', accent: '#e8b04a' },
} satisfies Record<string, Speaker>;

export type SpeakerId = keyof typeof SPEAKERS;
/** `expression` picks e.g. portraits/gerard-child-sorprendido.png; lines without one, or with one not generated yet, use the plain portrait. */
export interface DialogueLine { speaker: SpeakerId; text: string; expression?: string }
export interface Dialogue {
  left: SpeakerId;      // Gerard, normally
  right?: SpeakerId;    // whoever he is talking to, if anyone
  lines: DialogueLine[];
}

/** Who talks from Gerard's side when they are not the one on it. */
const PARTY = new Set<SpeakerId>(['gerard', 'gerard35', 'bernat', 'aitor']);

const TYPE_SPEED_MS = 16;      // per character; 0 disables the typewriter
const AUTO_ADVANCE_MS = 4200;  // after a line finishes typing; 0 waits for input

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
  function stopTimers() { clearInterval(typing); clearTimeout(advanceTimer); typing = advanceTimer = undefined; }
  function finishLine() {
    stopTimers();
    text.textContent = fullText;
    root.dataset.typing = 'false';
    if (current) onSpeak?.(current.lines[index], false);
    if (AUTO_ADVANCE_MS) advanceTimer = setTimeout(advance, AUTO_ADVANCE_MS);
  }
  function showLine() {
    if (!current) return;
    const line = current.lines[index];
    // Gerard's side is the party's; anyone else talks from the other side (a group: one after another).
    const side = line.speaker === current.left ? 'left' : line.speaker === current.right || !PARTY.has(line.speaker) ? 'right' : 'left';
    if (onSide[side] !== line.speaker && (side === 'right' || line.speaker !== current.left)) renderSide(side, line.speaker);
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
    if (!TYPE_SPEED_MS || reducedMotion.matches) { finishLine(); return; }
    let shown = 0;
    text.textContent = '';
    root.dataset.typing = 'true';
    typing = setInterval(() => {
      shown++;
      text.textContent = fullText.slice(0, shown);
      if (shown >= fullText.length) finishLine();
    }, TYPE_SPEED_MS);
  }
  /** `onDone` runs once the conversation closes, however it closes (or another one replaces it). */
  function show(dialogue: Dialogue, onDone?: () => void) {
    if (!dialogue.lines.length) { onDone?.(); return; }
    const previous = done;
    done = onDone;
    previous?.();
    current = dialogue;
    index = 0;
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
    if (typing) { finishLine(); return; }  // first press reveals the whole line
    if (index < current.lines.length - 1) { index++; showLine(); } else close();
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
