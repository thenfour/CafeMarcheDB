import { z } from "zod";

export type AuditValue = null | boolean | number | string | AuditValue[] | { [key: string]: AuditValue };
export const AuditValueSchema: z.ZodType<AuditValue> = z.lazy(() => z.union([
    z.null(), z.boolean(), z.number(), z.string(), z.array(AuditValueSchema), z.record(AuditValueSchema),
]));

export function parseAuditSnapshot(value: string | null): AuditValue {
    if (value === null) {
        return null;
    }
    try {
        return AuditValueSchema.parse(JSON.parse(value));
    } catch {
        // Some historical entries contain plain text or incomplete JSON. Keep the stored text visible.
        return value;
    }
}
