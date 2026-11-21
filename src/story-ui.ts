// Story HUD: chapter cards, item notes, one-line key hints, Bernat's speech bubble, a shout from
// afar, the ánima banner and the count of ánimas the party has to spend at home.
// There is no objective panel: what to do next comes from exploring and from people (AGENTS.md).
// Looks live in style.css (#story-card, .story-notes, .key-hint, #companion-bubble, #shout-bubble,
// .anima-banner, .anima-count).
import { ITEMS, ITEM_KIND_LABELS, type ItemId } from './items';
import { STORY_CARDS, STORY_HINTS } from './story';
import { ANIMA_NAMES, MANA_LEVEL, PASSIVES, SKILLS, type ClassId, type SkillId } from './battle';
import { LEVELLED, passivesAt } from './levels';
import { CLASSES } from './classes';

const ITEM_NOTE_MS = 4200;
const CARD_MS = 3400;
const BANNER_MS = 3600;
/** A cat's paw print, toes up (the Papagato banner's trail). */
const PAW = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 19c-5.5 0-11 6.6-11 11.2 0 3.4 2.7 5.3 5.6 5.3 2.2 0 3.6-1.1 5.4-1.1s3.2 1.1 5.4 1.1c2.9 0 5.6-1.9 5.6-5.3C31 25.6 25.5 19 20 19Z"/><ellipse cx="8" cy="17.5" rx="3.6" ry="4.6" transform="rotate(-20 8 17.5)"/><ellipse cx="15" cy="9.5" rx="3.6" ry="4.8" transform="rotate(-7 15 9.5)"/><ellipse cx="25" cy="9.5" rx="3.6" ry="4.8" transform="rotate(7 25 9.5)"/><ellipse cx="32" cy="17.5" rx="3.6" ry="4.6" transform="rotate(20 32 17.5)"/></svg>`;
/** Where each print of the trail lands (left, bottom in px), left and right foot in turn, walking up onto the card. */
const PAW_STEPS = [[0, 0], [34, 20], [22, 62], [56, 82], [44, 124], [78, 144]];
/** As the banner goes, the cat walks on up and off the card's top edge (the trail goes on from PAW_STEPS). */
const PAW_EXIT = [[66, 186], [100, 206], [88, 248], [122, 268]];
/** How long the banner takes to go: the card fades; Papagato's cat walks off first and its last prints fade last. */
const BANNER_OUT_MS = { cat: 1500, plain: 950 };

export function createStoryUI(hud: HTMLElement) {
  const notes = document.createElement('div');
  notes.className = 'story-notes'; notes.setAttribute('aria-live', 'polite');
  const hint = document.createElement('p');
  hint.className = 'key-hint'; hint.hidden = true; hint.setAttribute('aria-live', 'polite');
  hint.innerHTML = `<kbd></kbd><span></span>`;
  const bubble = document.createElement('p');
  bubble.id = 'companion-bubble'; bubble.hidden = true; bubble.setAttribute('aria-live', 'polite');
  // Someone shouting from afar (Uri from the top of his tower): a jagged bubble that never stops the game.
  const shout = document.createElement('p');
  shout.id = 'shout-bubble'; shout.hidden = true; shout.setAttribute('aria-live', 'polite');
  shout.innerHTML = `<span></span>`;
  let shoutLeaving: ReturnType<typeof setTimeout> | undefined;
  /** Measured once per line, not every frame. */
  let shoutSize = { w: 0, h: 0 };
  /** What `bubble` and `shout` last wrote, so a frame that moves nothing writes nothing. */
  let bubbleAt = '';
  const shoutAt = { tail: '', transform: '' };
  const card = document.createElement('section');
  card.id = 'story-card'; card.hidden = true; card.setAttribute('role', 'status');
  card.innerHTML = `<span class="battle-kicker"></span><h1></h1><p></p>`;
  // A full-screen black for the end of a dream: everything fades out, then back in elsewhere.
  const black = document.createElement('div');
  black.id = 'blackout'; black.setAttribute('aria-hidden', 'true');
  /**
   * Who is holding it dark: the story (a dream's end, a fall), a change of place, or the game
   * opening (it starts black, until the story has stood Gerard where the save left him). It is black
   * while any does, so one clearing never shows the picture under another, and asking for a dark
   * that is already there waits for nothing new.
   */
  const dark = { story: false, travel: false, boot: true };
  black.dataset.on = 'true';
  let settling = Promise.resolve();
  function darken(who: keyof typeof dark, on: boolean, ms: number) {
    const was = dark.story || dark.travel || dark.boot;
    dark[who] = on;
    const now = dark.story || dark.travel || dark.boot;
    if (now === was) return settling;
    const wait = reducedMotion.matches ? 0 : ms;
    black.style.transitionDuration = `${wait}ms`;
    black.dataset.on = String(now);
    return settling = new Promise<void>(resolve => setTimeout(resolve, wait));
  }
  // The snow globe shaken (docs/chapter-2.md § The snow globe): the picture goes white with snow, and clears somewhere else.
  const white = document.createElement('div');
  white.id = 'snowfall'; white.setAttribute('aria-hidden', 'true');
  // An ánima the party keeps for good: big, in the middle, in its own look (Papagato's has a cat's trail).
  const banner = document.createElement('section');
  banner.className = 'anima-banner'; banner.hidden = true; banner.setAttribute('role', 'status');
  // The card and the paws apart, so the cat can walk off while the card fades.
  banner.innerHTML = `<div class="anima-card"><span class="battle-kicker">ÁNIMA DESBLOQUEADA</span><h2></h2></div><div class="anima-paws" aria-hidden="true"></div>`;
  // The ánimas (the lights of the people helped) the party has to spend at home: beside the menus'
  // buttons (the dock is made after this, so it goes in the first time it shows).
  const count = document.createElement('p');
  count.className = 'anima-count'; count.hidden = true;
  count.innerHTML = `<i aria-hidden="true"></i><strong></strong><span></span>`;
  // The end of chapter 2's countdown: she has covered everything; the only button goes back a day.
  const doom = document.createElement('section');
  doom.id = 'doom'; doom.hidden = true; doom.setAttribute('role', 'alertdialog'); doom.setAttribute('aria-labelledby', 'doom-title');
  doom.innerHTML = `<span class="battle-kicker">LA REINA BUBBALOO</span><h1 id="doom-title">Lo ha cubierto todo.</h1><p>Barcelona es su castillo. Ya no queda casa a la que volver.</p><button type="button">Volver al día anterior</button><small>Se pierde lo que hicisteis ayer.</small>`;
  // The photo with the melon (docs/quests/universidad.md): a flash, then the scene held in a photo's border with its caption.
  const photo = document.createElement('figure');
  photo.id = 'story-photo'; photo.hidden = true; photo.setAttribute('role', 'status');
  photo.innerHTML = `<i class="story-photo-flash" aria-hidden="true"></i><figcaption></figcaption>`;
  // A boss of her castle beaten (docs/castle.md § Structure): her scream over the whole picture, which goes white.
  const scream = document.createElement('div');
  scream.id = 'queen-scream'; scream.setAttribute('role', 'status'); scream.dataset.on = 'false';
  scream.innerHTML = '<p></p>';
  // La Reina Bubbaloo singing to herself, unseen (docs/lore.md § Her music): her words come down from the top of the picture.
  const song = document.createElement('p');
  song.id = 'queen-song'; song.setAttribute('role', 'status'); song.hidden = true;
  let songGeneration = 0;
  hud.append(notes, hint, bubble, shout, card, banner, black, white, scream, song, doom, photo);
  let endDoom: (() => void) | undefined;
  doom.querySelector('button')!.addEventListener('click', () => endDoom?.());
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let hintGeneration = 0;

  return {
    item(id: ItemId) {
      const item = ITEMS[id];
      const el = document.createElement('article');
      el.className = 'story-note';
      el.style.setProperty('--note-accent', item.tint);
      el.innerHTML = `<svg class="story-note-icon" viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg><span class="battle-kicker"></span><strong></strong><p></p>`;
      el.querySelector('span')!.textContent = `HAS CONSEGUIDO · ${ITEM_KIND_LABELS[item.kind].toUpperCase()}`;
      el.querySelector('strong')!.textContent = item.name;
      el.querySelector('p')!.textContent = item.description;
      notes.append(el);
      setTimeout(() => { el.dataset.leaving = 'true'; setTimeout(() => el.remove(), reducedMotion.matches ? 0 : 300); }, ITEM_NOTE_MS);
    },
    /** What an afternoon left the party (src/days.ts `EVENINGS`): a note with its name and what it does, as it will read in a fight. */
    boost(name: string, effect: string) {
      const el = document.createElement('article');
      el.className = 'story-note'; el.style.setProperty('--note-accent', '#e9ad48');
      el.innerHTML = `<span class="battle-kicker">HASTA MAÑANA POR LA NOCHE</span><strong></strong><p></p>`;
      el.querySelector('strong')!.textContent = name;
      el.querySelector('p')!.textContent = effect;
      notes.append(el);
      setTimeout(() => { el.dataset.leaving = 'true'; setTimeout(() => el.remove(), reducedMotion.matches ? 0 : 300); }, ITEM_NOTE_MS * 1.5);
    },
    /**
     * La Reina Bubbaloo screams (a boss of her castle beaten): her words shake over the whole picture
     * while it goes white, longer and harder the more afraid she is (`fear` 1, 2). Resolves once it is
     * white; `unflash` clears it (as they wake).
     */
    scream(text: string, fear: number) {
      const ms = reducedMotion.matches ? 900 : 2300 + fear * 500;
      scream.querySelector('p')!.textContent = text;
      scream.style.setProperty('--scream', `${ms}ms`);
      scream.dataset.fear = String(fear); scream.dataset.on = 'true';
      return new Promise<void>(resolve => setTimeout(resolve, ms));
    },
    unflash() { scream.dataset.on = 'false'; },
    /**
     * La Reina Bubbaloo sings to herself, unseen (the end of chapter 1): each word comes down from the
     * top of the picture as she sings it, for as long as she holds it, and they stay, over the dark
     * too, until `unsing`.
     */
    sing(words: readonly { word: string; seconds: number }[]) {
      songGeneration++;
      let at = 0;
      song.replaceChildren(...words.map(({ word, seconds }) => {
        const span = document.createElement('span');
        span.textContent = word; span.style.setProperty('--at', `${at}s`); at += seconds;
        return span;
      }));
      delete song.dataset.leaving; song.hidden = false;
    },
    /** Her words fade away (in the dark, before they wake); resolves once they have gone. */
    unsing() {
      if (song.hidden) return Promise.resolve();
      const generation = songGeneration, ms = reducedMotion.matches ? 0 : 1500;
      song.dataset.leaving = 'true';
      return new Promise<void>(resolve => setTimeout(() => { if (generation === songGeneration) song.hidden = true; resolve(); }, ms));
    },
    /** An ánima woke up outside a fight (Nuria lends the cats): a note, ÁNIMA DESBLOQUEADA. */
    unlocked(classId: ClassId) {
      const el = document.createElement('article');
      el.className = 'story-note'; el.style.setProperty('--note-accent', CLASSES[classId].colour);
      el.innerHTML = `<span class="battle-kicker">ÁNIMA DESBLOQUEADA</span><strong></strong><p></p>`;
      el.querySelector('strong')!.textContent = ANIMA_NAMES[classId];
      el.querySelector('p')!.textContent = CLASSES[classId].motto;
      notes.append(el);
      setTimeout(() => { el.dataset.leaving = 'true'; setTimeout(() => el.remove(), reducedMotion.matches ? 0 : 300); }, ITEM_NOTE_MS * 1.5);
    },
    /**
     * An ánima is the party's for good (Papagato, Nuria's mission won): ÁNIMA DESBLOQUEADA and its
     * name, big in the middle; Papagato's comes with a trail of paw prints. It goes softly: the cat
     * walks on off the card, its prints fading behind it the oldest first, and the card fades away.
     * Resolves once it has gone.
     */
    kept(classId: ClassId) {
      banner.dataset.anima = classId;
      banner.style.setProperty('--banner-accent', CLASSES[classId].colour);
      banner.querySelector('h2')!.textContent = ANIMA_NAMES[classId];
      const cat = classId === 'papagato';
      banner.querySelector('.anima-paws')!.innerHTML = cat
        ? PAW_STEPS.map(([x, y], i) => `<i style="--x:${x}px;--y:${y}px;--i:${i}">${PAW}</i>`).join('')
          + PAW_EXIT.map(([x, y], j) => `<i class="exit" style="--x:${x}px;--y:${y}px;--j:${j}">${PAW}</i>`).join('') : '';
      delete banner.dataset.leaving;
      banner.hidden = true; void banner.offsetWidth; banner.hidden = false;
      const still = reducedMotion.matches;
      return new Promise<void>(resolve => setTimeout(() => {
        banner.dataset.leaving = 'true';
        setTimeout(() => { banner.hidden = true; delete banner.dataset.leaving; resolve(); }, still ? 0 : BANNER_OUT_MS[cat ? 'cat' : 'plain']);
      }, still ? BANNER_MS / 2 : BANNER_MS));
    },
    /**
     * How many Ecos de luz the party has to spend, or `undefined` to hide it (before any is won); `gained`
     * when one has just gone into Gerard or Aitor, so the count glows as it goes up.
     */
    animas(n: number | undefined, gained = false) {
      count.hidden = n === undefined;
      if (n === undefined) return;
      const dock = hud.querySelector('.journal-dock');
      if (dock && count.parentElement !== dock) dock.append(count);
      count.querySelector('strong')!.textContent = String(n);
      count.querySelector('span')!.textContent = n === 1 ? 'eco de luz' : 'ecos de luz';
      if (!gained) return;
      delete count.dataset.gain; void count.offsetWidth; count.dataset.gain = 'true';
    },
    /** An ánima grew (src/levels.ts): a note like an item's, with what it learned. */
    learn(classId: ClassId, level: number, skills: SkillId[]) {
      const el = document.createElement('article');
      el.className = 'story-note'; el.style.setProperty('--note-accent', CLASSES[classId].colour);
      el.innerHTML = `<span class="battle-kicker"></span><strong></strong><p></p>`;
      el.querySelector('span')!.textContent = `ÁNIMA · ${ANIMA_NAMES[classId].toUpperCase()} · NIVEL ${level}`;
      // A level that teaches no skill says what it gives: a passive (Olor a sangre, Remolino) or, at level 4, a point of maná.
      const learned = SKILLS.filter(skill => skills.includes(skill.id)), passives = passivesAt(classId, level);
      const gifts = [...learned.map(skill => ({ name: skill.name, description: skill.description })), ...passives.map(id => ({ name: PASSIVES[id].name, description: PASSIVES[id].description ?? '' }))];
      const mana = level === MANA_LEVEL && LEVELLED.includes(classId);
      el.querySelector('strong')!.textContent = gifts.length ? `Aprende ${gifts.map(g => g.name).join(' y ')}` : mana ? 'Maná +1' : 'Se hace más fuerte';
      el.querySelector('p')!.textContent = gifts.length ? gifts.map(g => g.description).join(' ') : mana ? `Sube en 1 el maná de ${ANIMA_NAMES[classId]}.` : '';
      notes.append(el);
      setTimeout(() => { el.dataset.leaving = 'true'; setTimeout(() => el.remove(), reducedMotion.matches ? 0 : 300); }, ITEM_NOTE_MS * 1.5);
    },
    /** A key and a verb that stays until the player has used it (or a newer hint replaces it). */
    hint(id: keyof typeof STORY_HINTS, learned?: () => boolean) {
      const generation = ++hintGeneration;
      const spec = STORY_HINTS[id], key = hint.querySelector('kbd')!;
      // Most hints name an action, so the key follows the device in use (input-glyphs.ts).
      if ('glyph' in spec) key.dataset.glyph = spec.glyph; else { delete key.dataset.glyph; key.textContent = spec.keys; }
      hint.querySelector('span')!.textContent = STORY_HINTS[id].verb;
      hint.hidden = false; delete hint.dataset.learned;
      const hide = () => { if (generation === hintGeneration) hint.hidden = true; };
      const check = () => {
        if (generation !== hintGeneration || hint.hidden) return;
        if (learned?.()) { hint.dataset.learned = 'true'; setTimeout(hide, 700); } else requestAnimationFrame(check);
      };
      if (learned) requestAnimationFrame(check);
    },
    /** Places what Bernat says above his head; `at` is his screen position, or nothing to hide it. */
    bubble(text: string | undefined, at: { x: number; y: number } | undefined) {
      // Every frame: only what changed is written (a write of the same value still costs a style pass).
      const hidden = !text || !at;
      if (bubble.hidden !== hidden) bubble.hidden = hidden;
      if (!text || !at) return;
      if (bubble.textContent !== text) bubble.textContent = text;
      const transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -100%)`;
      if (transform !== bubbleAt) { bubbleAt = transform; bubble.style.transform = transform; }
    },
    /**
     * A shout from afar over the shouter's head (`at`, in CSS pixels), every frame; nothing to let it
     * go. Kept inside the screen: when the shouter is above it, it hangs from the top edge with its
     * tail pointing up, towards them.
     */
    shout(line: { text: string; x: number; y: number } | undefined) {
      const span = shout.querySelector('span')!;
      if (!line) {
        if (shout.hidden || shoutLeaving) return;
        shout.dataset.leaving = 'true';
        shoutLeaving = setTimeout(() => { shout.hidden = true; delete shout.dataset.leaving; shoutLeaving = undefined; span.textContent = ''; }, reducedMotion.matches ? 0 : 250);
        return;
      }
      clearTimeout(shoutLeaving); shoutLeaving = undefined; delete shout.dataset.leaving;
      // A new line pops in again.
      if (span.textContent !== line.text || shout.hidden) {
        span.textContent = line.text; shout.hidden = true; void shout.offsetWidth; shout.hidden = false;
        shoutSize = { w: shout.offsetWidth, h: shout.offsetHeight };
      }
      const margin = 18, tail = 20, { w, h } = shoutSize;
      const x = Math.min(Math.max(line.x, margin + w / 2), innerWidth - margin - w / 2);
      const above = line.y - tail - h < margin;
      const y = above ? margin + tail : Math.min(line.y - tail - h, innerHeight - margin - h);
      const tailSide = above ? 'up' : 'down', tailX = `${Math.min(Math.max(line.x - (x - w / 2), 22), w - 22)}px`, transform = `translate(${(x - w / 2).toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (shout.dataset.tail !== tailSide) shout.dataset.tail = tailSide;
      if (tailX !== shoutAt.tail) { shoutAt.tail = tailX; shout.style.setProperty('--tail-x', tailX); }
      if (transform !== shoutAt.transform) { shoutAt.transform = transform; shout.style.transform = transform; }
    },
    /** Fades the whole screen to black (`on`) or back; resolves when the fade ends. */
    /** The camera's flash, then the frame held as a photo with `caption` for a few seconds; resolves when it is put away. */
    photo(caption: string) {
      photo.querySelector('figcaption')!.textContent = caption;
      photo.hidden = false; photo.dataset.state = 'flash';
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 0 : ms));
      return (async () => {
        await wait(260); photo.dataset.state = 'held';
        await wait(3200); photo.dataset.state = 'out';
        await wait(500); photo.hidden = true; delete photo.dataset.state;
      })();
    },
    snow(on: boolean, ms = on ? 700 : 1100) {
      white.style.transitionDuration = `${reducedMotion.matches ? 0 : ms}ms`;
      // Flakes of every size, each falling at its own pace; gone once the white has cleared.
      if (on) white.replaceChildren(...Array.from({ length: 90 }, () => {
        const flake = document.createElement('i'), size = 2 + Math.random() ** 2 * 9;
        flake.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 110 - 10}%;width:${size}px;height:${size}px;opacity:${.55 + Math.random() * .45};animation-duration:${9 - size * .6}s`;
        return flake;
      }));
      else setTimeout(() => { if (white.dataset.on !== 'true') white.replaceChildren(); }, ms + 50);
      white.dataset.on = String(on);
      return new Promise<void>(resolve => setTimeout(resolve, reducedMotion.matches ? 0 : ms));
    },
    blackout: (on: boolean, ms = 900) => darken('story', on, ms),
    /** The dark between two places: quick out, a little slower back in. */
    veil: (on: boolean) => darken('travel', on, on ? 220 : 340),
    /** The game opens: out of the black it started in, once the place to show is drawn. */
    open: () => darken('boot', false, 600),
    /** Back to that black before the game opens (the welcome screen's «Continuar», src/main.ts): then `open` clears it where the save left them. */
    shut: () => darken('boot', true, 700),
    /** Whether the picture is already hidden (black, or white with snow): a place can change under it with no fade of its own. */
    get covered() { return dark.story || dark.travel || dark.boot || white.dataset.on === 'true' || scream.dataset.on === 'true'; },
    /** A full-screen title, e.g. the chapter opening; resolves once it has faded. */
    card(id: keyof typeof STORY_CARDS) {
      const c = STORY_CARDS[id];
      card.querySelector('span')!.textContent = c.kicker;
      card.querySelector('h1')!.textContent = c.title;
      card.querySelector('p')!.textContent = c.text;
      card.hidden = false; card.dataset.state = 'in';
      return new Promise<void>(resolve => {
        setTimeout(() => {
          card.dataset.state = 'out';
          setTimeout(() => { card.hidden = true; resolve(); }, reducedMotion.matches ? 0 : 600);
        }, reducedMotion.matches ? CARD_MS / 2 : CARD_MS);
      });
    },
    /** The end screen; resolves when the player goes back a day. */
    doom() {
      doom.hidden = false;
      doom.querySelector('button')!.focus({ preventScroll: true });
      // A key still held from the last line of dialogue must not skip it.
      const shown = performance.now();
      return new Promise<void>(resolve => { endDoom = () => { if (performance.now() - shown < 1800) return; doom.hidden = true; endDoom = undefined; resolve(); }; });
    },
    get doomOpen() { return !doom.hidden; },
    /** A controller's confirm on the end screen. */
    confirmDoom() { endDoom?.(); },
    destroy() { hintGeneration++; clearTimeout(shoutLeaving); notes.remove(); hint.remove(); bubble.remove(); shout.remove(); card.remove(); banner.remove(); count.remove(); song.remove(); doom.remove(); },
  };
}
