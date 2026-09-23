// Conversation banner: who is talking, to whom, and what they say.
// Tweak looks in style.css (#dialogue custom properties) and voices here.

export interface Speaker {
  name: string;
  portrait?: string;
  skin: string;
  hair: string;
  top: string;     // jacket / sweater colour, also used as the avatar tint
  accent: string;  // ring + name colour while speaking
}

export const SPEAKERS = {
  gerard: { name: 'Gerard', portrait: `${import.meta.env.BASE_URL}portraits/gerard-child.png`, skin: '#e6b58b', hair: '#342a28', top: '#e9ad48', accent: '#f0c46a' },
  bernat: { name: 'Bernat', skin: '#dcb08a', hair: '#5b4636', top: '#6f8fa8', accent: '#9fc3d9' },
} satisfies Record<string, Speaker>;

export type SpeakerId = keyof typeof SPEAKERS;
export interface DialogueLine { speaker: SpeakerId; text: string }
export interface Dialogue {
  left: SpeakerId;      // Gerard, normally
  right?: SpeakerId;    // whoever he is talking to, if anyone
  lines: DialogueLine[];
}

const TYPE_SPEED_MS = 16;      // per character; 0 disables the typewriter
const AUTO_ADVANCE_MS = 4200;  // after a line finishes typing; 0 waits for input

// Blocky bust that echoes the in-game character: shoulders, neck, head, hair cap.
function portrait(s: Speaker) {
  if (s.portrait) return `<img class="portrait" src="${s.portrait}" alt="" aria-hidden="true" width="160" height="160" />`;
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
    <button class="next" type="button"><span>Continuar</span><kbd>E</kbd></button>`;
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
  function show(dialogue: Dialogue) {
    if (!dialogue.lines.length) return;
    current = dialogue;
    index = 0;
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
