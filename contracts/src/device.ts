import { z } from 'zod';
import { DeviceStatusSchema, BLEStateSchema } from './enums.js';

export const DeviceStateSchema = z.object({
  deviceId: z.string().min(1),
  deviceState: DeviceStatusSchema,
  bleState: BLEStateSchema,
  currentZone: z.string().min(1),
  employeeId: z.string().min(1).optional(),
  lastSeenAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type DeviceState = z.infer<typeof DeviceStateSchema>;
