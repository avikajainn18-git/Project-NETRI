import { z } from 'zod';
import { SeveritySchema, IncidentStatusSchema } from './enums.js';
import { EscalationStateSchema } from './events.js';

export const IncidentSchema = z.object({
  incidentId: z.string().min(1),
  deviceId: z.string().min(1),
  employeeId: z.string().min(1),
  locationZone: z.string().min(1),
  severity: SeveritySchema,
  status: IncidentStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  assignedResponderId: z.string().nullable().default(null),
  escalationState: EscalationStateSchema.default('MONITORED'),
  acknowledgedAt: z.string().datetime({ offset: true }).nullable().default(null),
  resolvedAt: z.string().datetime({ offset: true }).nullable().default(null),
  cancelledAt: z.string().datetime({ offset: true }).nullable().default(null),
  dedupCount: z.number().int().nonnegative().default(0),
});

export type Incident = z.infer<typeof IncidentSchema>;
