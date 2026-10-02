import { z } from 'zod';
import { ResponderAvailabilitySchema } from './enums.js';

export const ResponderSchema = z.object({
  responderId: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  availabilityState: ResponderAvailabilitySchema,
  activeIncidentId: z.string().nullable().optional(),
});

export type Responder = z.infer<typeof ResponderSchema>;
