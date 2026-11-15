import { stickDirection, type Direction, type Stick } from './movement.ts';

export const CONTROL_ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu'] as const;
export type ControlAction = typeof CONTROL_ACTIONS[number];
export type Binding = { button: number } | { axis: number; sign: -1 | 1 };
export type ControllerProfile = Record<ControlAction, Binding>;
/**
 * The D-pad's sides on their own, where they stand apart from walking (a fight: its up and down walk
 * the menus and its left and right open the summary, `readController`'s `apart`).
 */
export type DpadSide = 'left' | 'right';
export type DpadEvent = `dpad-${DpadSide}`;
/**
 * Fixed extras on recognised pads: the top face button opens the status screen, L / R (the shoulder
 * buttons) turn its pages, Select/− toggles the overview; and the D-pad apart (`DpadEvent`).
 */
export type ControllerEvent = ControlAction | 'character' | 'overview' | 'prev' | 'next' | DpadEvent;
/** Whether a press was one of the D-pad's sides set apart. */
export const isDpad = (event: ControllerEvent): event is DpadEvent => event.startsWith('dpad-');
export interface PadSnapshot {
  id: string; index: number; connected: boolean; mapping: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}
/**
 * Pads the browser reports without the standard layout but whose layout is known, rewritten as
 * standard ones. The Switch 2 Pro Controller by USB (after `just wake-pad`) comes as raw HID: its
 * buttons in report order (B A Y X R ZR + RS ↓ → ← ↑ L ZL − LS Home Capture GR GL C) and its sticks
 * as X, Y, Rx, Rz (axes 0, 1, 3, 5), up positive.
 */
const SWITCH2_BUTTONS = [0, 1, 2, 3, 12, 4, 13, 5, 14, 6, 15, 7, 11, 8, 10, 9, 16];
export function normalizePad(pad: PadSnapshot): PadSnapshot {
  if (pad.mapping === 'standard' || !/057e.*2069/i.test(pad.id)) return pad;
  const none = { pressed: false, value: 0 };
  return { id: pad.id, index: pad.index, connected: pad.connected, mapping: 'standard',
    buttons: SWITCH2_BUTTONS.map(i => pad.buttons[i] ?? none),
    axes: [pad.axes[0] ?? 0, -(pad.axes[1] ?? 0), pad.axes[3] ?? 0, -(pad.axes[5] ?? 0)] };
}
/** The connected pads, each in the standard layout when it is known (`normalizePad`). */
export function readPads(): PadSnapshot[] {
  try { return [...(navigator.getGamepads?.() ?? [])].filter((p): p is Gamepad => !!p?.connected).map(normalizePad); }
  catch { return []; } // Restricted browser contexts may deny the API.
}
/**
 * `stick` is the analog vector (screen space, y down) when the stick, not the D-pad, drives `direction`.
 * `dpad` is the D-pad's side when it stands apart from walking (`readController`'s `apart`); otherwise null.
 */
export interface ControllerState { direction: Direction | null; stick: Stick | null; dpad: DpadSide | null; confirm: boolean; cancel: boolean; menu: boolean; character: boolean; overview: boolean; prev: boolean; next: boolean }
export const idleController = (): ControllerState => ({ direction: null, stick: null, dpad: null, confirm: false, cancel: false, menu: false, character: false, overview: false, prev: false, next: false });
export function isNintendo(id: string) { return /nintendo|joy-con|switch|057e|pro controller/i.test(id); }
/**
 * Only Safari on macOS reads pads through Apple's GameController layer, which already reports Nintendo
 * pads by label (A = button 0). Chrome, Edge and Firefox (on macOS too) report them by position, like
 * any standard pad, with A on the right (button 1), so they need the swap.
 */
export const osLabelsNintendoFaceButtons = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
  && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(navigator.userAgent);
export function defaultProfile(pad: PadSnapshot, osLabels = osLabelsNintendoFaceButtons): ControllerProfile | undefined {
  if (pad.mapping !== 'standard') return undefined;
  const swap = isNintendo(pad.id) && !osLabels;
  return { up: { button: 12 }, down: { button: 13 }, left: { button: 14 }, right: { button: 15 },
    confirm: { button: swap ? 1 : 0 }, cancel: { button: swap ? 0 : 1 }, menu: { button: 9 } };
}
export function validProfile(value: unknown): value is ControllerProfile {
  if (!value || typeof value !== 'object') return false;
  return CONTROL_ACTIONS.every(action => {
    const binding = (value as ControllerProfile)[action];
    if (!binding || typeof binding !== 'object') return false;
    return 'button' in binding ? Number.isInteger(binding.button) && binding.button >= 0 && binding.button < 128
      : Number.isInteger(binding.axis) && binding.axis >= 0 && binding.axis < 32 && (binding.sign === -1 || binding.sign === 1);
  });
}
export function bindingPressed(pad: PadSnapshot, binding: Binding) {
  return 'button' in binding ? !!pad.buttons[binding.button]?.pressed
    : (pad.axes[binding.axis] ?? 0) * binding.sign > .55;
}
/**
 * What `pad` is pressing. The D-pad and the stick both give `direction`, the D-pad first; `apart`
 * (a fight) sets the D-pad's left and right aside: they are `dpad` and give no `direction`. A pad
 * with a custom mapping has one or the other bound, so for it nothing is set aside.
 */
export function readController(pad: PadSnapshot, custom?: ControllerProfile, previous: Direction | null = null, apart = false): ControllerState {
  const profile = custom ?? defaultProfile(pad);
  if (!pad.connected || !profile) return idleController();
  const directions = ['up', 'down', 'left', 'right'] as const;
  const pressed = directions.find(key => 'button' in profile[key] && bindingPressed(pad, profile[key]));
  const dpad = apart && !custom && (pressed === 'left' || pressed === 'right') ? pressed : null;
  const digital = dpad ? undefined : pressed;
  const strength = (key: Direction) => {
    const binding = profile[key];
    return 'axis' in binding ? Math.max(0, (pad.axes[binding.axis] ?? 0) * binding.sign) : 0;
  };
  const x = custom ? strength('right') - strength('left') : pad.axes[0] ?? 0;
  const y = custom ? strength('down') - strength('up') : pad.axes[1] ?? 0;
  const direction = digital ?? stickDirection(x, y, previous);
  const stick = !digital && direction ? { x, y } : null;
  const extra = (button: number) => !custom && !!pad.buttons[button]?.pressed;
  return { direction, stick, dpad, confirm: bindingPressed(pad, profile.confirm), cancel: bindingPressed(pad, profile.cancel),
    menu: bindingPressed(pad, profile.menu), character: extra(3), overview: extra(8), prev: extra(4), next: extra(5) };
}
/** One physical press cannot leak into the next screen or trigger after focus returns. */
export class ControllerEdges {
  private previous = idleController();
  private context = '';
  private blocked = true;
  private repeatAt = 0;
  update(state: ControllerState, context: string, now: number, enabled = true) {
    const events: ControllerEvent[] = [];
    if (!enabled || context !== this.context) { this.blocked = true; this.context = context; }
    if (this.blocked) {
      if (enabled && !state.direction && !state.dpad && !state.confirm && !state.cancel && !state.menu && !state.character && !state.overview && !state.prev && !state.next) this.blocked = false;
      this.previous = state;
      return { direction: null, stick: null, running: false, events };
    }
    for (const action of ['menu', 'character', 'overview', 'prev', 'next', 'cancel', 'confirm'] as const) if (state[action] && !this.previous[action]) events.push(action);
    // The D-pad's sides apart are a shortcut: one press, one event, no repeat.
    if (state.dpad && state.dpad !== this.previous.dpad) events.push(`dpad-${state.dpad}`);
    if (state.direction) {
      if (state.direction !== this.previous.direction) { events.push(state.direction); this.repeatAt = now + 350; }
      else if (now >= this.repeatAt) { events.push(state.direction); this.repeatAt = now + 130; }
    }
    this.previous = state;
    // The back button doubles as hold-to-run during exploration.
    return { direction: state.direction, stick: state.stick, running: state.cancel, events };
  }
}
