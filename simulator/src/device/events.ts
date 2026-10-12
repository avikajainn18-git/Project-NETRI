// NETRI — device-event contract (device → transport boundary).
//
// This is the event shape the real firmware emits over its transport
// (Phase 1 sketch: EMERGENCY_TRIGGERED + TRANSPORT delivered=false). The app
// publishes it over the simulated-BLE transport; the simulator UI never builds
// device events directly — only DeviceController does.

export interface EmergencyTriggeredEvent {
  readonly kind: "EMERGENCY_TRIGGERED";
  readonly deviceId: string;
  readonly occurredAtMs: number;
  /** Device-side event is emitted before the gateway confirms delivery. */
  readonly delivered: boolean;
}

export type DeviceEvent = EmergencyTriggeredEvent;
