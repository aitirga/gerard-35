/**
 * Who controls whom (docs/party.md). Player 1 is the keyboard, mouse and first controller, and
 * always plays Gerard. From chapter 2, player 2 plays Aitor on a second controller. Pure rules:
 * `main.ts` feeds in the mode and whether a second controller is connected.
 */
export type PlayerId = 1 | 2;
/**
 * `duo` is the game: Aitor belongs to player 2. `solo` is for development only: Aitor follows
 * Gerard and player 1 also picks Aitor's moves in battle.
 */
export type ControlMode = 'duo' | 'solo';
export interface Control { mode: ControlMode; secondPad: boolean }

/** Whether player 2 walks Aitor around; otherwise he follows Gerard's steps. */
export function partnerDriven(control: Control, partner: string | undefined) {
  return partner === 'aitor' && control.mode === 'duo' && control.secondPad;
}
/**
 * Who picks a fighter's moves. In `duo` Aitor's turn always belongs to player 2, even before the
 * second controller is connected (the fight waits for it); everyone else is player 1's.
 */
export function battleDriver(control: Control, allyId: string): PlayerId {
  return allyId === 'aitor' && control.mode === 'duo' ? 2 : 1;
}
/** Aitor's turn is waiting for player 2 to connect a controller. */
export function waitingForPlayer2(control: Control, allyId: string) {
  return battleDriver(control, allyId) === 2 && !control.secondPad;
}
