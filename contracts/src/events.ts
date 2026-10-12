import { z } from 'zod';

export const EmergencyEventSchema = z.object({
  eventId: z.string().min(1),
  kind: z.literal('EMERGENCY_TRIGGERED'),
  deviceId: z.string().min(1),
  employeeId: z.string().min(1),
  locationZone: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  source: z.enum(['SIMULATOR', 'FIRMWARE']),
  transport: z.literal('SIMULATED_BLE'),
});

export type EmergencyEvent = z.infer<typeof EmergencyEventSchema>;

export const EscalationStateSchema = z.enum(['MONITORED', 'ESCALATED', 'STOPPED']);
export type EscalationState = z.infer<typeof EscalationStateSchema>;

export const IncidentTimelineEntrySchema = z.object({
  timelineId: z.string().min(1),
  incidentId: z.string().min(1),
  type: z.enum([
    'CREATED',
    'ASSIGNED',
    'ACKNOWLEDGED',
    'RESOLVED',
    'CANCELLED',
    'ESCALATED',
    'DUPLICATE_RECEIVED',
  ]),
  message: z.string().min(1),
  actorId: z.string().nullable().default(null),
  createdAt: z.string().datetime({ offset: true }),
});

export type IncidentTimelineEntry = z.infer<typeof IncidentTimelineEntrySchema>;
