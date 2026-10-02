import { z } from 'zod';

export const EmergencyContactSchema = z.object({
  contactId: z.string().min(1),
  name: z.string().min(1),
  relationship: z.string().min(1),
  phoneNumber: z.string().min(1),
});

export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;