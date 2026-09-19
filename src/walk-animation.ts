const TAU = Math.PI * 2;

/** A continuous gait: grid-cell boundaries must never restart the pose. */
export class WalkAnimation {
  private phase = 0;
  private weight = 0;
  private stride = 0;
  private lift = 0;
  private sway = 0;

  update(dt: number, moving: boolean, animate = true, cycleSeconds = .38) {
    const delta = Math.min(Math.max(dt, 0), .05);
    if (!animate) {
      this.phase = this.weight = this.stride = this.lift = this.sway = 0;
      return { stride: 0, lift: 0, sway: 0, weight: 0 };
    }
    // Keep time through starts, stops and turns; ease the pose into and out of idle.
    this.phase = (this.phase + delta * TAU / cycleSeconds) % TAU;
    const blend = 1 - Math.exp(-delta / .055);
    this.weight += ((moving ? 1 : 0) - this.weight) * blend;
    this.stride += ((moving ? Math.sin(this.phase) * 27 : 0) - this.stride) * blend;
    // Two rounded bounces per cycle, with matching velocity at the loop seam.
    this.lift += ((moving ? (1 - Math.cos(this.phase * 2)) * .0325 : 0) - this.lift) * blend;
    this.sway += ((moving ? Math.sin(this.phase) * 1.8 : 0) - this.sway) * blend;
    return { stride: this.stride, lift: this.lift, sway: this.sway, weight: this.weight };
  }
}
