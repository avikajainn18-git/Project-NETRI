// NETRI — device state machine (Phase 2 simulator core).
//
// Deliberately mirrors the APPROVED Phase-1 firmware semantics exactly
// (firmware/include/netri/netri_trigger.h — host-tested there, re-verified
// here as an independent implementation with the same rule set):
//   - a press held CONTINUOUSLY >= HOLD_MS triggers the emergency,
//   - a press shorter than HOLD_MS never triggers,
//   - the 40 ms debounce window only rejects contact bounce and never
//     extends the threshold (hold clock anchored at press start),
//   - the emergency LATCHES: release does NOT re-arm or clear it, a fresh
//     press cannot re-fire while latched, and only reset()/power-cycle
//     returns the device to the armed/idle state (no RESOLVE exists yet).
//
// No timers, no React, no DOM — advance() is the single entry point, so the
// same logic can later be driven by real sensor/transport loops unchanged.

export const HOLD_MS = 2000; // APPROVED threshold (Phase 1 config)
export const DEBOUNCE_MS = 40; // Phase 1 tuning value (PROPOSED there, reused here)

export enum TriggerState {
  IDLE = "IDLE",
  DEBOUNCE = "DEBOUNCE",
  HOLDING = "HOLDING",
  EMERGENCY = "EMERGENCY", // latched; terminal for Phase 1/2
}

export enum TriggerEventKind {
  NONE = "NONE",
  EMERGENCY_TRIGGERED = "EMERGENCY_TRIGGERED",
}

export interface TriggerSnapshot {
  readonly state: TriggerState;
  /** 0..1 progress of the continuous hold; 1 exactly when latched. */
  readonly holdProgress: number;
  readonly latched: boolean;
  /** Raw physical level from the last update (drives the pressed look). */
  readonly held: boolean;
}

export class TriggerFsm {
  private state = TriggerState.IDLE;
  private pressStartedAtMs = 0;
  private lastNowMs = 0;
  private lastPressed = false;

  /**
   * Advance the FSM to `nowMs` with the current button level.
   * Returns the event fired by THIS update (NONE otherwise). The emergency
   * fires exactly once; afterwards the state is latched until reset().
   */
  update(nowMs: number, pressed: boolean): TriggerEventKind {
    this.lastNowMs = nowMs;
    this.lastPressed = pressed;

    switch (this.state) {
      case TriggerState.IDLE:
        if (pressed) {
          this.state = TriggerState.DEBOUNCE;
          this.pressStartedAtMs = nowMs; // hold clock anchored HERE
        }
        break;

      case TriggerState.DEBOUNCE:
        if (!pressed) {
          this.state = TriggerState.IDLE; // bounce or too-short blip
        } else if (nowMs - this.pressStartedAtMs >= DEBOUNCE_MS) {
          this.state = TriggerState.HOLDING;
        }
        break;

      case TriggerState.HOLDING:
        if (!pressed) {
          this.state = TriggerState.IDLE; // released before threshold
        } else if (nowMs - this.pressStartedAtMs >= HOLD_MS) {
          this.state = TriggerState.EMERGENCY;
          return TriggerEventKind.EMERGENCY_TRIGGERED; // fires exactly once
        }
        break;

      case TriggerState.EMERGENCY:
        // Latched: button level is irrelevant until reset()/power-cycle.
        break;
    }
    return TriggerEventKind.NONE;
  }

  snapshot(): TriggerSnapshot {
    const latched = this.state === TriggerState.EMERGENCY;
    const holding =
      (this.state === TriggerState.HOLDING || this.state === TriggerState.DEBOUNCE) &&
      this.lastPressed;
    const holdProgress = latched
      ? 1
      : holding
        ? Math.min(1, Math.max(0, (this.lastNowMs - this.pressStartedAtMs) / HOLD_MS))
        : 0;
    return { state: this.state, holdProgress, latched, held: this.lastPressed };
  }

  /** Power-cycle: the only Phase 1/2 path out of the latched emergency. */
  reset(): void {
    this.state = TriggerState.IDLE;
    this.pressStartedAtMs = 0;
  }
}
