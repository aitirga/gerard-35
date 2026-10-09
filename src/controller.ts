import { stickDirection, type Direction, type Stick } from './movement.ts';

export const CONTROL_ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu'] as const;
export type ControlAction = typeof CONTROL_ACTIONS[number];
export type Binding = { button: number } | { axis: number; sign: -1 | 1 };
export type ControllerProfile = Record<ControlAction, Binding>;
/** Fixed extras on recognised pads: the top face button opens the character panel, Select/− toggles the overview. */
export type ControllerEvent = ControlAction | 'character' | 'overview';
export interface PadSnapshot {
  id: string; index: number; connected: boolean; mapping: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}
/** `stick` is the analog vector (screen space, y down) when the stick, not the D-pad, drives `direction`. */
export interface ControllerState { direction: Direction | null; stick: Stick | null; confirm: boolean; cancel: boolean; menu: boolean; character: boolean; overview: boolean }
export const idleController = (): ControllerState => ({ direction: null, stick: null, confirm: false, cancel: false, menu: false, character: false, overview: false });
export function isNintendo(id: string) { return /nintendo|joy-con|switch|057e|pro controller/i.test(id); }
/** macOS' GameController layer already reports Nintendo pads by label (A = button 0), so only other platforms need the swap. */
export const osLabelsNintendoFaceButtons = typeof document !== 'undefined' && /Mac/.test(navigator.userAgent);
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
export function readController(pad: PadSnapshot, custom?: ControllerProfile, previous: Direction | null = null): ControllerState {
  const profile = custom ?? defaultProfile(pad);
  if (!pad.connected || !profile) return idleController();
  const directions = ['up', 'down', 'left', 'right'] as const;
  const digital = directions.find(key => 'button' in profile[key] && bindingPressed(pad, profile[key]));
  const strength = (key: Direction) => {
    const binding = profile[key];
    return 'axis' in binding ? Math.max(0, (pad.axes[binding.axis] ?? 0) * binding.sign) : 0;
  };
  const x = custom ? strength('right') - strength('left') : pad.axes[0] ?? 0;
  const y = custom ? strength('down') - strength('up') : pad.axes[1] ?? 0;
  const direction = digital ?? stickDirection(x, y, previous);
  const stick = !digital && direction ? { x, y } : null;
  const extra = (button: number) => !custom && !!pad.buttons[button]?.pressed;
  return { direction, stick, confirm: bindingPressed(pad, profile.confirm), cancel: bindingPressed(pad, profile.cancel),
    menu: bindingPressed(pad, profile.menu), character: extra(3), overview: extra(8) };
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
      if (enabled && !state.direction && !state.confirm && !state.cancel && !state.menu && !state.character && !state.overview) this.blocked = false;
      this.previous = state;
      return { direction: null, stick: null, running: false, events };
    }
    for (const action of ['menu', 'character', 'overview', 'cancel', 'confirm'] as const) if (state[action] && !this.previous[action]) events.push(action);
    if (state.direction) {
      if (state.direction !== this.previous.direction) { events.push(state.direction); this.repeatAt = now + 350; }
      else if (now >= this.repeatAt) { events.push(state.direction); this.repeatAt = now + 130; }
    }
    this.previous = state;
    // The back button doubles as hold-to-run during exploration.
    return { direction: state.direction, stick: state.stick, running: state.cancel, events };
  }
}
