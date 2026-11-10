import { DeviceStatusSchema, BLEStateSchema } from "@netri/contracts";
import { z } from 'zod';

// Phase 1 placeholder — deliberately minimal. No domain logic, no state
// management. This is the only piece of mock data the Phase 1 console
// renders, and the seam through which real backend data will arrive later.
export const DEVICES: readonly {
  deviceId: string;
  deviceState: z.infer<typeof DeviceStatusSchema>;
bleState: z.infer<typeof BLEStateSchema>;
  currentZone: string;
}[] = [
  {
    deviceId: "NETRI-001",
    deviceState: "OPERATIONAL",
    bleState: "CONNECTED",
    currentZone: "Library",
  },
];
