import { describe, expect, expectTypeOf, it } from "vitest";
import {
    ZodToPrismaSelection,
} from "shared/prismaUtils";
import { z } from "zod";

describe("ZodToPrismaSelection", () => {
    it("derives scalar, object, collection, and wrapped selections", () => {
        const schema = z.object({
            id: z.number().int(),
            label: z.string().optional(),
            parent: z.object({
                id: z.number().int(),
                name: z.string().nullable(),
            }).nullable().optional(),
            children: z.array(z.object({
                id: z.number().int(),
                active: z.boolean().default(false),
            })).optional(),
            scalarValues: z.array(z.string()),
            refinedValue: z.string().refine(value => value.length > 0),
        });

        const selection = ZodToPrismaSelection(schema);

        expect(selection).toEqual({
            select: {
                id: true,
                label: true,
                parent: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                children: {
                    select: {
                        id: true,
                        active: true,
                    },
                },
                scalarValues: true,
                refinedValue: true,
            },
        });
        expectTypeOf(selection.select.parent).toMatchTypeOf<{
            readonly select: { readonly id: true; readonly name: true };
        }>();
    });

    it("rejects ambiguous nested schemas instead of guessing at a relation shape", () => {
        const deriveRuntime = ZodToPrismaSelection as unknown as (
            schema: z.ZodTypeAny,
        ) => unknown;
        const schema = z.object({
            ambiguous: z.union([
                z.object({ id: z.number().int() }),
                z.string(),
            ]),
        });

        expect(() => deriveRuntime(schema))
            .toThrow("ambiguous Zod schema at '$root.ambiguous'");
        expect(() => deriveRuntime(z.string()))
            .toThrow("only supports ZodObject schemas");
    });
});
