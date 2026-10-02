// NETRI — DeviceController: the simulator's device "runtime".
//
// Owns the pure TriggerFsm, ticks it from a requestAnimationFrame/UI loop,
// derives the visual state (mirroring the Phase 1 sketch's visual_state()),
// and emits DeviceEvents at the boundary where the Phase 3 simulated-BLE
// transport will subscribe. The UI only renders controller snapshots and
// forwards physical interaction — it never touches FSM internals directly.
//
// All time-varying presentation values (LED blink phase, hold progress) are
// computed HERE so a render is a pure function of the snapshot.

import { SystemClock, type IClock } from "./clock";
import type { DeviceEvent } from "./events";
import {
  TriggerFsm,
  TriggerState,
  TriggerEventKind,
  type TriggerSnapshot,
} from "./triggerFsm";

export enum DeviceVisualState {
  BOOT_SELF_TEST = "BOOT_SELF_TEST",
  IDLE_READY = "IDLE_READY",
  HOLDING = "HOLDING",
  EMERGENCY = "EMERGENCY",
}

export interface DeviceSnapshot {
  readonly visual: DeviceVisualState;
  readonly trigger: TriggerSnapshot;
  readonly deviceId: string;
  readonly bootedAtMs: number;
  readonly selfTest: boolean;
  /** Green-LED level (blink phase already applied). */
  readonly greenOn: boolean;
  /** Red-LED level. */
  readonly redOn: boolean;
}

export type DeviceListener = (snapshot: DeviceSnapshot) => void;
export type EventListener = (event: DeviceEvent) => void;

const BOOT_SELF_TEST_MS = 700; // brief power-on self-test window
const FAST_BLINK_MS = 120; // arming cadence (Phase 1 netri_indicators.h)

export class DeviceController {
  private readonly clock: IClock;
  private readonly fsm = new TriggerFsm();
  private readonly listeners = new Set<DeviceListener>();
  private readonly eventListeners = new Set<EventListener>();
  private bootedAtMs: number;
  private deviceId: string;
  private pressed = false;
  private lastEmitAtMs = 0;
  private cached: DeviceSnapshot;

  constructor(clock: IClock = new SystemClock(), deviceId = "NETRI-001") {
    this.clock = clock;
    this.deviceId = deviceId;
    this.bootedAtMs = clock.nowMs();
    this.cached = this.buildSnapshot();
  }

  // -- subscription ----------------------------------------------------------

  onSnapshot(listener: DeviceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // -- physical interaction (the ONLY ways the device can be driven) ----------

  pressTrigger(): void {
    this.pressed = true;
  }

  releaseTrigger(): void {
    this.pressed = false;
  }

  /** Restart / power-cycle: clears the latched emergency, runs self-test. */
  restart(): void {
    this.fsm.reset();
    this.pressed = false;
    this.bootedAtMs = this.clock.nowMs(); // re-enter BOOT_SELF_TEST window
    this.lastEmitAtMs = 0;
    this.emit();
  }

  // -- loop -------------------------------------------------------------------

  /** Call every animation frame (or any ~16 ms tick). */
  tick(): void {
    const nowMs = this.clock.nowMs();
    const event = this.fsm.update(nowMs, this.pressed);

    if (event === TriggerEventKind.EMERGENCY_TRIGGERED) {
      // Phase 2 boundary: events are recorded and observable locally only.
      // Phase 3 will forward them to the simulated-BLE gateway transport.
      const deviceEvent: DeviceEvent = {
        kind: "EMERGENCY_TRIGGERED",
        deviceId: this.deviceId,
        occurredAtMs: nowMs,
        delivered: false, // Phase 1 truth: no transport, honest no-op
      };
      for (const listener of this.eventListeners) listener(deviceEvent);
    }

    this.emit(nowMs);
  }

  // -- snapshot ---------------------------------------------------------------

  snapshot(): DeviceSnapshot {
    return this.cached;
  }

  private buildSnapshot(): DeviceSnapshot {
    const nowMs = this.clock.nowMs();
    const trigger = this.fsm.snapshot();
    const visual = this.visualState(trigger, nowMs);

    // LED mapping — Phase 1 netri_indicators.h, owner-directed:
    //   boot/idle  → green solid, red off
    //   holding    → green fast blink, red off
    //   emergency  → green off, red solid (latched)
    let greenOn: boolean;
    switch (visual) {
      case DeviceVisualState.BOOT_SELF_TEST:
      case DeviceVisualState.IDLE_READY:
        greenOn = true;
        break;
      case DeviceVisualState.HOLDING:
        greenOn = Math.floor(nowMs / FAST_BLINK_MS) % 2 === 0;
        break;
      case DeviceVisualState.EMERGENCY:
        greenOn = false;
        break;
    }

    return {
      visual,
      trigger,
      deviceId: this.deviceId, // D6 ID; boot-time selection is firmware-side
      bootedAtMs: this.bootedAtMs,
      selfTest: nowMs - this.bootedAtMs < BOOT_SELF_TEST_MS,
      greenOn,
      redOn: visual === DeviceVisualState.EMERGENCY,
    };
  }

  private visualState(
    trigger: TriggerSnapshot,
    nowMs: number,
  ): DeviceVisualState {
    if (trigger.latched || trigger.state === TriggerState.EMERGENCY) {
      return DeviceVisualState.EMERGENCY;
    }
    if (
      trigger.state === TriggerState.HOLDING ||
      trigger.state === TriggerState.DEBOUNCE
    ) {
      return DeviceVisualState.HOLDING;
    }
    if (nowMs - this.bootedAtMs < BOOT_SELF_TEST_MS) {
      return DeviceVisualState.BOOT_SELF_TEST;
    }
    return DeviceVisualState.IDLE_READY;
  }

  private emit(nowMs: number = this.clock.nowMs()): void {
    // Throttle re-renders to ~30 fps; the 120 ms blink and progress ring
    // remain smooth at that rate.
    if (nowMs - this.lastEmitAtMs < 33) return;
    this.lastEmitAtMs = nowMs;
    this.cached = this.buildSnapshot();
    for (const listener of this.listeners) listener(this.cached);
  }
}
