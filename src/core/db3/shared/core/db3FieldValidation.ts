import { z } from "zod";
import type { AnyDB3Field, DB3FieldCodec, DB3ReadTransportValueOf, DB3RowMode } from "../db3core";

// adapter for db3 fields -> zod schema

type FieldWriteValue<TField extends AnyDB3Field> = TField extends { readonly writeTransportSchema: z.ZodType<infer TValue> }
    ? TValue : TField extends { readonly codec: DB3FieldCodec<unknown, unknown, infer TValue> }
    ? TValue : DB3ReadTransportValueOf<TField>;
type InheritableWriteValue<TField extends AnyDB3Field> = FieldWriteValue<TField>
    | (TField extends { readonly inheritsValue: true } ? null : never);

/** Prepared field transport is converted back to its client value before ordinary field validation. */
export function withDB3FieldValidation<TSchema extends z.ZodTypeAny>(field: AnyDB3Field, schema: TSchema, mode: DB3RowMode) {
    return schema.superRefine((value, context) => {
        // Registry-discovered fields own different row shapes; validate just the selected field's members.
        const member = field.fkidMember ?? field.member;
        const transport = { [member]: value };
        const client = { ...transport };
        field.ApplyDbToClient(transport, client, mode);
        const result = field.ValidateAndParse({ row: client, mode });
        if (result.result === "error") {
            context.addIssue({ code: z.ZodIssueCode.custom, message: result.errorMessage! });
        }
    });
}

/** Reuse the field's transport, conversion, and validation contract outside a form or CRUD envelope. */
export function deriveFieldWriteSchema<TField extends AnyDB3Field>(field: TField, mode: DB3RowMode = "update"):
    z.ZodType<InheritableWriteValue<TField>> {
    let schema = field.writeTransportSchema ?? field.codec?.writeSchema ?? field.readTransportSchema;
    if (!schema) {
        throw new Error(`Field '${field.member}' has no write transport schema.`);
    }
    if (field.inheritsValue) {
        schema = schema.nullable();
    }
    const validated = withDB3FieldValidation(field, schema, mode);
    // Conditional field metadata above describes the same runtime schema selected here.
    return validated as z.ZodType<InheritableWriteValue<TField>>;
}
