import { z } from 'zod';

export const ResponderAvailabilitySchema = z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']);
export type ResponderAvailability = z.infer<typeof ResponderAvailabilitySchema>;

export const SeveritySchema = z.enum(['MEDIUM', 'HIGH', 'CRITICAL']);
export type Severity = z.infer<typeof SeveritySchema>;

export const IncidentStatusSchema = z.enum([
  'ACTIVE',
  'ASSIGNED',
  'ACKNOWLEDGED',
  'RESOLVED',
  'CANCELLED',
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const DeviceStatusSchema = z.enum([
  'OPERATIONAL',
  'ARMING',
  'EMERGENCY_LATCHED',
  'FAULT',
]);
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const BLEStateSchema = z.enum(['CONNECTED', 'DISCONNECTED']);
export type BLEState = z.infer<typeof BLEStateSchema>;
