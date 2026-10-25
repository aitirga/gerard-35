// Conversation banner: who is talking, to whom, and what they say.
// Tweak looks in style.css (#dialogue custom properties) and voices here.
import PORTRAIT_EXPRESSIONS from './portraits.json';

export interface Speaker {
  name: string;
  /** Portrait in public/portraits/ without .png; `just character` creates it and its expressions. */
  portrait?: string;
  /** Inline SVG for a provisional portrait, until `just character` makes a real one. */
  art?: string;
  skin: string;
  hair: string;
  top: string;     // jacket / sweater colour, also used as the avatar tint
  accent: string;  // ring + name colour while speaking
}

export const SPEAKERS = {
  gerard: { name: 'Gerard', portrait: 'gerard-child', skin: '#e6b58b', hair: '#342a28', top: '#e9ad48', accent: '#f0c46a' },
  bernat: { name: 'Bernat', skin: '#dcb08a', hair: '#5b4636', top: '#6f8fa8', accent: '#9fc3d9' },
  mama: { name: 'Mamá', skin: '#e8bc96', hair: '#6b4a32', top: '#b5645a', accent: '#e9a294' },
  jan: { name: 'Jan', skin: '#e6b58b', hair: '#2b2220', top: '#5e8a5a', accent: '#a5cf8f' },
  /** Chapter 2: Gerard at 35 (provisional portrait: round glasses, pyjama). */
  gerard35: {
    name: 'Gerard', skin: '#e6b58b', hair: '#342a28', top: '#6d8db0', accent: '#f0c46a',
    art: `<svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#6d8db0" opacity=".18"/>
      <path d="M9 48c0-9 6-13 15-13s15 4 15 13Z" fill="#6d8db0"/><rect x="21" y="29" width="6" height="7" fill="#e6b58b"/>
      <rect x="15" y="11" width="18" height="20" rx="4" fill="#e6b58b"/>
      <path d="M14 18v-5a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v5h-2l-1-4c-4 2-9 2-14 0l-1 4Z" fill="#342a28"/>
      <circle cx="19.5" cy="21" r="3.2" fill="none" stroke="#302520" stroke-width="1.2"/><circle cx="28.5" cy="21" r="3.2" fill="none" stroke="#302520" stroke-width="1.2"/>
      <path d="M22.7 21h2.6" stroke="#302520" stroke-width="1"/><circle cx="19.5" cy="21" r=".9" fill="#342a28"/><circle cx="28.5" cy="21" r=".9" fill="#342a28"/>
      <path d="M21 27c2 1.4 4 1.4 6 0" stroke="#8b5140" stroke-width="1.1" fill="none"/>
    </svg>`,
  },
  /** Gerard's partner (provisional: a man a little taller than Gerard, short beard, glasses). */
  aitor: {
    name: 'Aitor', skin: '#dcae8a', hair: '#3a2a20', top: '#c9b49a', accent: '#e7c9a1',
    art: `<svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#c9b49a" opacity=".2"/>
      <path d="M8 48c0-9 6-14 16-14s16 5 16 14Z" fill="#c9b49a"/><rect x="21" y="28" width="6" height="7" fill="#dcae8a"/>
      <rect x="15" y="9" width="18" height="21" rx="4" fill="#dcae8a"/>
      <path d="M15 15v-3a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v3h-1l-1-2H18l-2 2Z" fill="#3a2a20"/>
      <path d="M15 21v4c0 5 4 8 9 8s9-3 9-8v-4l-2 3c-1 2-3 2-4 1h-6c-1 1-3 1-4-1Z" fill="#4a3426"/>
      <path d="M20 26c2 1 6 1 8 0" stroke="#7a4636" stroke-width="1.2" fill="none"/>
      <rect x="16" y="17.5" width="7" height="5" rx="1" fill="none" stroke="#1f1c1c" stroke-width="1.2"/><rect x="25" y="17.5" width="7" height="5" rx="1" fill="none" stroke="#1f1c1c" stroke-width="1.2"/>
      <path d="M23 19.5h2" stroke="#1f1c1c" stroke-width="1"/><circle cx="19.5" cy="20" r=".9" fill="#2a1d16"/><circle cx="28.5" cy="20" r=".9" fill="#2a1d16"/>
    </svg>`,
  },
  /** Nuria (docs/quests/nuria.md). */
  nuria: { name: 'Nuria', portrait: 'nuria', skin: '#e9bf9c', hair: '#3b2a22', top: '#f1e8da', accent: '#c8423b' },
  /** Uri (docs/quests/nuria.md); `crio` is his face while the Queen holds him. */
  uri: { name: 'Uri', portrait: 'uri', skin: '#e3b38f', hair: '#2e2420', top: '#f5f3ef', accent: '#9a6cd8' },
} satisfies Record<string, Speaker>;

export type SpeakerId = keyof typeof SPEAKERS;
/** `expression` picks e.g. portraits/gerard-child-sorprendido.png; lines without one, or with one not generated yet, use the plain portrait. */
export interface DialogueLine { speaker: SpeakerId; text: string; expression?: string }
export interface Dialogue {
  left: SpeakerId;      // Gerard, normally
  right?: SpeakerId;    // whoever he is talking to, if anyone
  lines: DialogueLine[];
}

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
  if (s.art) return s.art;
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

  function renderSide(slot: 'left' | 'right', id: SpeakerId | undefined) {
    const el = sides[slot];
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
    if (AUTO_ADVANCE_MS) advanceTimer = setTimeout(advance, AUTO_ADVANCE_MS);
  }
  function showLine() {
    if (!current) return;
    const line = current.lines[index];
    const side = line.speaker === current.right ? 'right' : 'left';
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

  return { show, advance, close, get open() { return !!current; } };
}
