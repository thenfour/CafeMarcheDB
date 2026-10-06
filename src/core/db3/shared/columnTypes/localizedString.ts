import type { LocalizedStringFormat } from "@prisma/client";
import { z } from "zod";
import type { PublicId } from "shared/publicId";
import { DynamicStringIdentitySchema, LocalizedFieldEditSchema } from "src/locale/shared/dynamicStringWrite";
import type { StringResolution } from "src/locale/shared/stringResolution";
import {
    type DB3AuthSpec, type DB3FieldCodec, type DB3ReadPresenceForAuthSpec, type DB3RowMode,
    FieldBase, ErrorValidateAndParseResult, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs,
} from "../db3core";
import { GenericStringField } from "./genericString";

export const stringResolutionSchema: z.ZodType<StringResolution> = z.object({
    value: z.string().nullable(), localeTag: z.string().nullable(), scope: z.enum(["band", "global"]).nullable(),
    source: z.enum(["stored", "registry", "missing"]),
    reason: z.enum(["exact", "language", "system", "any", "registry-default", "unavailable-override", "missing"]),
    requestedTag: z.string().nullable(),
});
export type LocalizedFieldEdit = z.infer<typeof LocalizedFieldEditSchema>;

/** Display text and an explicit translation edit are different client values. */
export interface LocalizedFieldValue {
    readonly value: string | null;
    readonly resolution: StringResolution | null;
    readonly stringPublicId: PublicId<"DynamicLocalizedString"> | null;
    readonly canInherit: boolean;
    readonly edit?: LocalizedFieldEdit;
}
export function emptyLocalizedFieldValue(): LocalizedFieldValue {
    return { value: null, resolution: null, stringPublicId: null, canInherit: false };
}
export function localizedText(value: unknown): string | null {
    if (typeof value === "string" || value === null) {
        return value;
    }
    return isLocalizedFieldValue(value) ? value.value : null;
}
export function isLocalizedFieldValue(value: unknown): value is LocalizedFieldValue {
    return typeof value === "object" && value !== null && "value" in value && "stringPublicId" in value && "resolution" in value;
}

// DB3 field APIs receive heterogeneous rows; these implementations validate only their declared member.
/** The field keeps DB3 string predicates and validation; the shared reader supplies its resolved value. */
export class LocalizedStringField<const TAuth extends DB3AuthSpec, const TIdentityMember extends string = string> extends FieldBase<
    LocalizedFieldValue,
    DB3FieldCodec<string | null, LocalizedFieldValue, LocalizedFieldEdit | undefined>,
    true, string | null, LocalizedFieldValue, DB3ReadPresenceForAuthSpec<TAuth>
> {
    readonly stringIdentityMember: TIdentityMember;
    readonly stringFormat: LocalizedStringFormat;
    readonly localized = true;
    readonly writeTransportSchema = LocalizedFieldEditSchema;
    readonly readCompanionSchemas: z.ZodRawShape;
    readonly textField: GenericStringField<true, TAuth>;
    readonly codec: DB3FieldCodec<string | null, LocalizedFieldValue, LocalizedFieldEdit | undefined> = {
        decode: value => ({ ...emptyLocalizedFieldValue(), value }),
        encode: value => value.edit,
        writeSchema: LocalizedFieldEditSchema.optional(),
    };
    getReadSupportMembers = () => [this.stringIdentityMember];

    constructor(args: TAuth & { columnName: string; stringIdentityMember: TIdentityMember; stringFormat: LocalizedStringFormat }) {
        const textField = new GenericStringField({ ...args, allowNull: true,
            format: args.stringFormat === "Markdown" ? "markdown" : "raw",
            allowQuickFilter: args.stringFormat === "PlainText", maxLength: args.stringFormat === "PlainText" ? 768 : 1_000_000 });
        super({ member: args.columnName, fieldTableAssociation: "tableColumn", defaultValue: emptyLocalizedFieldValue(),
            readTransportSchema: z.string().nullable(), authMap: textField.authMap, _customAuth: textField._customAuth,
            specialFunction: textField.specialFunction });
        this.textField = textField;
        this.stringIdentityMember = args.stringIdentityMember;
        this.stringFormat = args.stringFormat;
        this.readCompanionSchemas = {
            [`${this.member}Resolution`]: stringResolutionSchema,
            [`${this.member}StringPublicId`]: DynamicStringIdentitySchema.nullable(),
        };
    }

    connectToTable = (table: Parameters<GenericStringField["connectToTable"]>[0]) => this.textField.connectToTable(table);
    getQuickFilterWhereClause = (query: string) => this.textField.getQuickFilterWhereClause(query);
    getCustomFilterWhereClause = (query: Parameters<GenericStringField["getCustomFilterWhereClause"]>[0]) => this.textField.getCustomFilterWhereClause(query);
    getOverallWhereClause = () => this.textField.getOverallWhereClause();
    SqlGetQuickFilterElementsForToken = (...args: Parameters<GenericStringField["SqlGetQuickFilterElementsForToken"]>) => this.textField.SqlGetQuickFilterElementsForToken(...args);
    SqlGetDiscreteCriterionElements = (...args: Parameters<GenericStringField["SqlGetDiscreteCriterionElements"]>) => this.textField.SqlGetDiscreteCriterionElements(...args);
    SqlGetFacetInfoQuery = (...args: Parameters<GenericStringField["SqlGetFacetInfoQuery"]>) => this.textField.SqlGetFacetInfoQuery(...args);
    SqlGetSortableQueryElements = (...args: Parameters<GenericStringField["SqlGetSortableQueryElements"]>) => this.textField.SqlGetSortableQueryElements(...args);
    ApplyIncludeFiltering = () => {};
    isEqual = (left: LocalizedFieldValue, right: LocalizedFieldValue) => JSON.stringify(left.edit) === JSON.stringify(right.edit);

    hydrateReadTransportValue = (value: string | null, row?: Readonly<Record<string, unknown>>): LocalizedFieldValue => ({
        value, resolution: stringResolutionSchema.parse(row?.[`${this.member}Resolution`]),
        stringPublicId: DynamicStringIdentitySchema.nullable().parse(row?.[`${this.member}StringPublicId`]),
        canInherit: row?.globalPublicId != null,
    });
    ApplyToNewRow = (row: { [member: string]: unknown }) => { row[this.member] = emptyLocalizedFieldValue(); };
    ApplyDbToClient = (row: { [member: string]: unknown }, client: { [member: string]: unknown }, mode: DB3RowMode) => {
        const value = row[this.member];
        if (value === undefined) {
            return;
        }
        if (mode === "view") {
            client[this.member] = this.hydrateReadTransportValue(z.string().nullable().parse(value), row);
            return;
        }
        const edit = this.writeTransportSchema.parse(value);
        client[this.member] = { ...emptyLocalizedFieldValue(), value: edit.kind === "set" ? edit.value : null,
            stringPublicId: edit.stringPublicId, edit } satisfies LocalizedFieldValue;
    };
    ApplyClientToDb = (row: { [member: string]: unknown }, mutation: { [member: string]: unknown }) => {
        const value = row[this.member];
        if (value === undefined) {
            return;
        }
        if (!isLocalizedFieldValue(value)) {
            throw new Error(`Localized field '${this.member}' requires its locale-aware client value.`);
        }
        if (value.edit) {
            mutation[this.member] = this.writeTransportSchema.parse(value.edit);
        }
    };
    ValidateAndParse = (args: ValidateAndParseArgs<LocalizedFieldValue>) => {
        const value: unknown = args.row[this.member];
        if (value === undefined) {
            return UndefinedValidateAndParseResult();
        }
        if (!isLocalizedFieldValue(value)) {
            return ErrorValidateAndParseResult("Expected a locale-aware client value.", { [this.member]: args.row[this.member] });
        }
        if (value.edit) {
            const edit = this.writeTransportSchema.safeParse(value.edit);
            if (!edit.success) {
                return ErrorValidateAndParseResult(edit.error.message, { [this.member]: value });
            }
            if (edit.data.kind === "set") {
                const text = this.textField.ValidateAndParse({ ...args, row: { [this.member]: edit.data.value } });
                if (text.result !== "success") {
                    return ErrorValidateAndParseResult(text.errorMessage!, { [this.member]: value });
                }
            }
        }
        return SuccessfulValidateAndParseResult({ [this.member]: value });
    };
}
