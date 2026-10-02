import { z } from 'zod';
import { SeveritySchema, IncidentStatusSchema } from './enums.js';

export const IncidentSchema = z.object({
  incidentId: z.string().min(1),
  deviceId: z.string().min(1),
  employeeId: z.string().min(1),
  locationZone: z.string().min(1),
  severity: SeveritySchema,
  status: IncidentStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  assignedResponderId: z.string().nullable().optional(),
});

export type Incident = z.infer<typeof IncidentSchema>;
