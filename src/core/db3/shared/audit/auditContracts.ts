import { z } from "zod";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";
import { AuditValueSchema } from "./auditSnapshot";

export const AuditFilterInputSchema = PresentationInputSchema;
export const AuditDetailInputSchema = PresentationInputSchema.extend({ changeId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();
export type AuditDetailInput = z.infer<typeof AuditDetailInputSchema>;
export const AuditReferenceSchema = z.object({
    publicId: z.string(), label: z.string(), bandPublicId: z.string().nullable(),
    href: z.string().nullable(), deleted: z.boolean(),
}).strict();
export type AuditReference = z.infer<typeof AuditReferenceSchema>;
export const AuditDetailSchema = z.object({
    user: z.object({ publicId: z.string(), name: z.string() }).strict().nullable(),
    record: AuditReferenceSchema.nullable(), related: z.array(AuditReferenceSchema),
    oldValues: AuditValueSchema, newValues: AuditValueSchema,
}).strict();
export type AuditDetail = z.infer<typeof AuditDetailSchema>;
