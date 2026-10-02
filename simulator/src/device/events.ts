// NETRI — device-event contract (Phase 2 local boundary).
//
// This is the event shape the real firmware emits over its transport
// (Phase 1 sketch: EMERGENCY_TRIGGERED + TRANSPORT delivered=false). Phase 3
// will publish these over the simulated-BLE transport; the simulator UI never
// builds them directly — only DeviceController does.

export interface EmergencyTriggeredEvent {
  readonly kind: "EMERGENCY_TRIGGERED";
  readonly deviceId: string;
  readonly occurredAtMs: number;
  /** Phase 1 truth: no transport exists, delivery is always false. */
  readonly delivered: boolean;
}

export type DeviceEvent = EmergencyTriggeredEvent;
