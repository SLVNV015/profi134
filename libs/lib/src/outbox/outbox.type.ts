import z from 'zod';
import { EventMessage } from '../interfaces/event-message.interface';

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
export type Json = Literal | { [key: string]: Json } | Json[];

export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]),
);

export enum OutboxStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  FAILED = 'FAILED',
  SEND = 'SEND',
}

export const outboxSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: jsonSchema,
  timestamp: z.number(),
  correlationId: z.string(),
  retryCount: z.number().default(0),
  status: z.nativeEnum(OutboxStatus).default(OutboxStatus.CREATED),
  createdAt: z.date(),
  updatedAt: z.date(),
}) satisfies z.ZodType<EventMessage>;

export type OutboxEntity = z.infer<typeof outboxSchema>;
