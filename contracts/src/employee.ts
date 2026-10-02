import { z } from 'zod';
import { EmergencyContactSchema } from './contact.js';

export const EmployeeSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  deviceId: z.string().min(1),
  assignedLocation: z.string().optional(),
  emergencyContacts: z.array(EmergencyContactSchema).default([]),
});

export type Employee = z.infer<typeof EmployeeSchema>;
