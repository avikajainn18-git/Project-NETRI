import { z } from 'zod';

export const AcknowledgeIncidentPayloadSchema = z.object({
  responderId: z.string().min(1),
});
export type AcknowledgeIncidentPayload = z.infer<typeof AcknowledgeIncidentPayloadSchema>;
export const AcknowledgeIncidentActionSchema = AcknowledgeIncidentPayloadSchema;
export type AcknowledgeIncidentAction = AcknowledgeIncidentPayload;

export const ResolveIncidentPayloadSchema = z.object({
  responderId: z.string().min(1),
  notes: z.string().optional(),
});
export type ResolveIncidentPayload = z.infer<typeof ResolveIncidentPayloadSchema>;
export const ResolveIncidentActionSchema = ResolveIncidentPayloadSchema;
export type ResolveIncidentAction = ResolveIncidentPayload;

export const CancelIncidentPayloadSchema = z.object({
  actorId: z.string().min(1),
  reason: z.string().optional(),
});
export type CancelIncidentPayload = z.infer<typeof CancelIncidentPayloadSchema>;
export const CancelIncidentActionSchema = CancelIncidentPayloadSchema;
export type CancelIncidentAction = CancelIncidentPayload;
