/**
 * Which input the player is using right now, and the key or button to show for each action.
 * The HUD only ever shows the device in use (keyboard and mouse, or the pad last touched):
 * mark an element with `data-glyph="confirm"` to show one key, `data-glyph-template` to fill
 * "{confirm} Confirmar · {cancel} Volver", or `data-device="keyboard|gamepad"` for content that
 * only one of them needs. `watchGlyphs` keeps all of it in step, including elements added later.
 */
import { isNintendo } from './controller.ts';

export type InputDevice = 'keyboard' | 'xbox' | 'playstation' | 'nintendo' | 'gamepad';
/** Pads by family; `gamepad` is any other pad, or one with a custom mapping. */
export function padFamily(id: string, custom = false): InputDevice {
  if (custom) return 'gamepad';
  if (isNintendo(id)) return 'nintendo';
  if (/playstation|dualshock|dualsense|054c|sony/i.test(id)) return 'playstation';
  if (/xbox|xinput|045e|microsoft/i.test(id)) return 'xbox';
  return 'gamepad';
}

type Row = Record<InputDevice, string>;
const pad = (xbox: string, playstation: string, nintendo: string, gamepad: string) => ({ xbox, playstation, nintendo, gamepad });
export const GLYPHS = {
  /** Accept the focused choice. */
  confirm: { keyboard: 'Enter', ...pad('A', '✕', 'A', 'Confirmar') },
  /** Back out, close. */
  cancel: { keyboard: 'Esc', ...pad('B', '○', 'B', 'Volver') },
  /** Use what is within reach, or advance a conversation. */
  interact: { keyboard: 'E', ...pad('A', '✕', 'A', 'Confirmar') },
  menu: { keyboard: 'Esc', ...pad('☰', 'Options', '+', 'Start') },
  move: { keyboard: 'W A S D', ...pad('Stick izq.', 'Stick izq.', 'Stick izq.', 'Stick') },
  run: { keyboard: 'Shift', ...pad('Mantén B', 'Mantén ○', 'Mantén B', 'Mantén Volver') },
  overview: { keyboard: 'R', ...pad('View', 'Create', '−', 'Select') },
  /** The character panel; on a pad, the top face button. */
  party: { keyboard: 'C', ...pad('Y', '△', 'X', 'Botón superior') },
  /** Items live in the menu on a pad. */
  items: { keyboard: 'I', ...pad('☰', 'Options', '+', 'Start') },
  /** A skill's details in battle: the top face button. */
  details: { keyboard: 'I', ...pad('Y', '△', 'X', 'Botón superior') },
  animaPrev: { keyboard: 'Q', ...pad('LB', 'L1', 'L', 'LB') },
  animaNext: { keyboard: 'E', ...pad('RB', 'R1', 'R', 'RB') },
  /** Walk a list up and down. */
  updown: { keyboard: '↑ ↓', ...pad('Cruceta', 'Cruceta', 'Cruceta', 'Cruceta') },
  /** Pick among targets in any direction. */
  arrows: { keyboard: '← ↑ ↓ →', ...pad('Cruceta', 'Cruceta', 'Cruceta', 'Cruceta') },
  /** Pick a battle command straight away. */
  pick: { keyboard: '1–5', ...pad('Cruceta', 'Cruceta', 'Cruceta', 'Cruceta') },
} as const satisfies Record<string, Row>;
export type Glyph = keyof typeof GLYPHS;

let device: InputDevice = 'keyboard';
const listeners = new Set<(device: InputDevice) => void>();
export const inputDevice = () => device;
export const usingPad = () => device !== 'keyboard';
export const glyph = (name: Glyph, on: InputDevice = device) => GLYPHS[name][on];
/** "{confirm} Confirmar" with the current device's keys; unknown names stay as written. */
export function glyphText(template: string, on: InputDevice = device) {
  return template.replace(/\{(\w+)\}/g, (all, name: string) => name in GLYPHS ? glyph(name as Glyph, on) : all);
}
/** The player just used `next`: everything that shows a key switches to it. */
export function setInputDevice(next: InputDevice) {
  if (next === device) return;
  device = next;
  listeners.forEach(listener => listener(device));
}
export function onInputDevice(listener: (device: InputDevice) => void) { listeners.add(listener); return () => listeners.delete(listener); }

function fill(el: HTMLElement) {
  const text = el.dataset.glyph ? glyph(el.dataset.glyph as Glyph) : el.dataset.glyphTemplate !== undefined ? glyphText(el.dataset.glyphTemplate) : undefined;
  if (text !== undefined && el.textContent !== text) el.textContent = text;
}
function fillAll(root: ParentNode) {
  if (root instanceof HTMLElement && (root.dataset.glyph || root.dataset.glyphTemplate !== undefined)) fill(root);
  root.querySelectorAll<HTMLElement>('[data-glyph], [data-glyph-template]').forEach(fill);
}
/**
 * Keyboard and mouse switch the page to `keyboard`; the controller poll reports pads. Sets
 * `html[data-input]` (style.css hides the other device's `[data-device]` content) and fills keys.
 */
export function watchGlyphs(doc: Document = document) {
  const html = doc.documentElement;
  const apply = () => {
    html.dataset.input = device === 'keyboard' ? 'keyboard' : 'gamepad';
    html.dataset.pad = device;
    fillAll(doc);
  };
  const toKeyboard = () => setInputDevice('keyboard');
  doc.addEventListener('keydown', toKeyboard, { capture: true });
  doc.addEventListener('pointerdown', toKeyboard, { capture: true });
  const stop = onInputDevice(apply);
  // New HUD pieces (battle menus, hints, dialogue) get the right keys as they appear.
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') fill(record.target as HTMLElement);
      else record.addedNodes.forEach(node => { if (node instanceof HTMLElement) fillAll(node); });
    }
  });
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-glyph', 'data-glyph-template'] });
  apply();
  return () => { stop(); observer.disconnect(); doc.removeEventListener('keydown', toKeyboard, { capture: true }); doc.removeEventListener('pointerdown', toKeyboard, { capture: true }); };
}
