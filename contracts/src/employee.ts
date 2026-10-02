import { z } from 'zod';

export const EmployeeSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  deviceId: z.string().min(1),
  assignedLocation: z.string().optional(),
});

export type Employee = z.infer<typeof EmployeeSchema>;
