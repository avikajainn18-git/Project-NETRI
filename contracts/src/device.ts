import { z } from 'zod';
import { DeviceStatusSchema, BLEStateSchema } from './enums.js';

export const DeviceStateSchema = z.object({
  deviceId: z.string().min(1),
  deviceState: DeviceStatusSchema,
  bleState: BLEStateSchema,
  currentZone: z.string().min(1),
});

export type DeviceState = z.infer<typeof DeviceStateSchema>;
