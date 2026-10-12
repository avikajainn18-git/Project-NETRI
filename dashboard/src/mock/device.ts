import { DeviceStatusSchema, BLEStateSchema } from "@netri/contracts";

// Phase 1 placeholder — deliberately minimal. No domain logic, no state
// management. This is the only piece of mock data the Phase 1 console
// renders, and the seam through which real backend data will arrive later.
export const DEVICES: readonly {
  deviceId: string;
  deviceState: typeof DeviceStatusSchema._type;
  bleState: typeof BLEStateSchema._type;
  currentZone: string;
}[] = [
  {
    deviceId: "NETRI-001",
    deviceState: "OPERATIONAL",
    bleState: "CONNECTED",
    currentZone: "Library",
  },
];
