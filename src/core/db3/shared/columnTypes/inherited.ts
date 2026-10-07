// a value which may be overridden. specifically made for band catalog models,
// like songTag, instrument, etc... where bands may create their own custom, or inherit
// from the global catalog.

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
    type AnyDB3Field, type DB3AuthSpec, type DB3FieldCodec, type DB3ReadConsumerValueOf,
    type DB3ReadTransportValueOf, type DB3ReadPresenceOf, type DB3RowMode, type ValidateAndParseArgs,
    FieldBase, ErrorValidateAndParseResult, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
} from "../db3core";
import { GenericStringField } from "./genericString";

export interface InheritedFieldValue<TValue> {
    readonly value: TValue;
    readonly override: TValue | null;
    readonly inheritedValue: TValue;
}
export function isInheritedFieldValue(value: unknown): value is InheritedFieldValue<unknown> {
    return typeof value === "object" && value !== null && "value" in value && "override" in value && "inheritedValue" in value;
}

// DB3 field APIs receive heterogeneous rows; these implementations validate only their declared member.
/** Keep effective display values separate from nullable overrides; never save a displayed fallback. */
export class InheritedField<TField extends AnyDB3Field> extends FieldBase<
    InheritedFieldValue<DB3ReadConsumerValueOf<TField> | null>,
    DB3FieldCodec<DB3ReadTransportValueOf<TField> | null, InheritedFieldValue<DB3ReadConsumerValueOf<TField> | null>, DB3ReadTransportValueOf<TField> | null>,
    true, DB3ReadTransportValueOf<TField>, InheritedFieldValue<DB3ReadConsumerValueOf<TField> | null>, DB3ReadPresenceOf<TField>
> {
    readonly inheritsValue = true;
    readonly readCompanionSchemas: z.ZodRawShape;
    readonly writeTransportSchema: z.ZodType<DB3ReadTransportValueOf<TField> | null>;
    readonly defaultTransportValue: DB3ReadTransportValueOf<TField> | null;
    readonly codec: DB3FieldCodec<DB3ReadTransportValueOf<TField> | null, InheritedFieldValue<DB3ReadConsumerValueOf<TField> | null>, DB3ReadTransportValueOf<TField> | null>;

    constructor(readonly valueField: TField) {
        const clientDefault = {};
        valueField.ApplyToNewRow(clientDefault, null);
        const defaultValue: DB3ReadConsumerValueOf<TField> = clientDefault[valueField.member];
        super({
            member: valueField.member, fieldTableAssociation: valueField.fieldTableAssociation,
            defaultValue: { value: defaultValue, override: defaultValue, inheritedValue: defaultValue },
            readTransportSchema: valueField.getReadTransportSchema(), specialFunction: valueField.specialFunction,
            authMap: valueField.authMap, _customAuth: valueField._customAuth
        });
        if (valueField.fieldTableAssociation !== "tableColumn") {
            throw new Error("Inheritance currently supports scalar DB3 fields.");
        }
        // Scalar catalog fields have the same read/write transport type; their codec still owns validation.
        this.writeTransportSchema = (valueField.codec?.writeSchema ?? valueField.getReadTransportSchema()).nullable() as z.ZodType<DB3ReadTransportValueOf<TField> | null>;
        this.readCompanionSchemas = {
            [`${this.member}Override`]: this.writeTransportSchema,
            [`${this.member}InheritedValue`]: this.writeTransportSchema,
        };
        const defaultMutation = {};
        valueField.ApplyClientToDb(clientDefault, defaultMutation, "new");
        this.defaultTransportValue = this.writeTransportSchema.parse(defaultMutation[this.member]);
        this.codec = {
            decode: value => {
                const decoded = this.decodeValue(value);
                return { value: decoded, override: decoded, inheritedValue: decoded };
            },
            encode: value => this.encodeOverride(value.override),
            writeSchema: this.writeTransportSchema,
        };
    }

    private decodeValue(value: DB3ReadTransportValueOf<TField> | null): DB3ReadConsumerValueOf<TField> | null {
        // A null override must not enter a nonnullable underlying read codec.
        return value === null ? null : this.valueField.hydrateReadTransportValue(value);
    }
    private encodeOverride(value: unknown): DB3ReadTransportValueOf<TField> | null {
        if (value === null) {
            return null;
        }
        const mutation = {};
        this.valueField.ApplyClientToDb({ [this.member]: value }, mutation, "update");
        return this.writeTransportSchema.parse(mutation[this.member]);
    }
    connectToTable = (...args: Parameters<AnyDB3Field["connectToTable"]>) => this.valueField.connectToTable(...args);
    getQuickFilterWhereClause = (...args: Parameters<AnyDB3Field["getQuickFilterWhereClause"]>) => this.valueField.getQuickFilterWhereClause(...args);
    getCustomFilterWhereClause = (...args: Parameters<AnyDB3Field["getCustomFilterWhereClause"]>) => this.valueField.getCustomFilterWhereClause(...args);
    getOverallWhereClause = () => this.valueField.getOverallWhereClause();
    SqlGetQuickFilterElementsForToken = (...args: Parameters<AnyDB3Field["SqlGetQuickFilterElementsForToken"]>) => this.valueField.SqlGetQuickFilterElementsForToken(...args);
    SqlGetDiscreteCriterionElements = (...args: Parameters<AnyDB3Field["SqlGetDiscreteCriterionElements"]>) => this.valueField.SqlGetDiscreteCriterionElements(...args);
    SqlGetFacetInfoQuery = (...args: Parameters<AnyDB3Field["SqlGetFacetInfoQuery"]>) => this.valueField.SqlGetFacetInfoQuery(...args);
    SqlGetSortableQueryElements = (...args: Parameters<AnyDB3Field["SqlGetSortableQueryElements"]>) => this.valueField.SqlGetSortableQueryElements(...args);
    ApplyIncludeFiltering = (...args: Parameters<AnyDB3Field["ApplyIncludeFiltering"]>) => this.valueField.ApplyIncludeFiltering(...args);
    isEqual = (left: InheritedFieldValue<DB3ReadConsumerValueOf<TField> | null>, right: InheritedFieldValue<DB3ReadConsumerValueOf<TField> | null>) => {
        if (left.override === null || right.override === null) {
            return left.override === right.override;
        }
        return this.valueField.isEqual(left.override, right.override);
    };
    hydrateReadTransportValue = (value: DB3ReadTransportValueOf<TField>, row?: Readonly<Record<string, unknown>>): InheritedFieldValue<DB3ReadConsumerValueOf<TField> | null> => ({
        value: this.decodeValue(value),
        override: this.decodeValue(this.writeTransportSchema.parse(row?.[`${this.member}Override`])),
        inheritedValue: this.decodeValue(this.writeTransportSchema.parse(row?.[`${this.member}InheritedValue`])),
    });
    ApplyToNewRow = (row: { [member: string]: unknown }) => { row[this.member] = this.defaultValue; };
    ApplyDbToClient = (row: { [member: string]: unknown }, client: { [member: string]: unknown }, mode: DB3RowMode) => {
        if (row[this.member] === undefined) {
            return;
        }
        client[this.member] = mode === "view"
            ? this.hydrateReadTransportValue(this.valueField.getReadTransportSchema().parse(row[this.member]), row)
            : this.codec.decode(this.writeTransportSchema.parse(row[this.member]));
    };
    ApplyClientToDb = (row: { [member: string]: unknown }, mutation: { [member: string]: unknown }) => {
        const value = row[this.member];
        if (value === undefined) {
            return;
        }
        if (!isInheritedFieldValue(value)) {
            throw new Error(`Inherited field '${this.member}' requires its override-aware client value.`);
        }
        mutation[this.member] = this.encodeOverride(value.override);
    };
    ValidateAndParse = (args: ValidateAndParseArgs<InheritedFieldValue<DB3ReadConsumerValueOf<TField> | null>>) => {
        const value: unknown = args.row[this.member];
        if (value === undefined) {
            return UndefinedValidateAndParseResult();
        }
        if (!isInheritedFieldValue(value)) {
            return ErrorValidateAndParseResult("Expected an override-aware client value.", { [this.member]: args.row[this.member] });
        }
        if (value.override === null) {
            return SuccessfulValidateAndParseResult({ [this.member]: args.row[this.member] });
        }
        const validated = this.valueField.ValidateAndParse({ ...args, row: { [this.member]: value.override } });
        if (validated.result !== "success") {
            return ErrorValidateAndParseResult(validated.errorMessage!, { [this.member]: args.row[this.member] });
        }
        const parsedValue = validated.values[this.member];
        return SuccessfulValidateAndParseResult({ [this.member]: { ...value, value: parsedValue, override: parsedValue } });
    };
}
export function inheritedField<TField extends AnyDB3Field>(field: TField): InheritedField<TField> {
    return new InheritedField(field);
}

export function serverOwnedField<TField extends AnyDB3Field>(field: TField): TField {
    field.ApplyToNewRow = () => { };
    return field;
}

/** A global source is a read dependency, never an editable relation or an unfiltered global DTO. */
export class CatalogSourceField<const TAuth extends DB3AuthSpec> extends GenericStringField<true, TAuth, false> {
    readonly catalogSource = true;
    readonly readCompanionSchemas = { globalPublicId: z.string().nullable() };
    readonly sourceTable: Exclude<keyof Prisma.TransactionClient, `$${string}`>;

    // called explicitly by resolveDB3ReadRows;
    // converts payload shape from
    //   { publicId: "some-id" }
    // to
    //   { globalPublicId: "some-id" }
    // TODO: assess whether it's actually safe to assume the `publicId` and `globalPublicId` field names.
    // this could *probably* eventually use better typing to strengthen assumptions
    resolveSourceReadCompanions(source: Readonly<Record<string, unknown>> | null) {
        return { globalPublicId: source?.publicId ?? null };
    }

    constructor(args: TAuth & { columnName: string; sourceTable: Exclude<keyof Prisma.TransactionClient, `$${string}`> }) {
        super({ ...args, allowNull: true, format: "raw", allowQuickFilter: false });
        this.ApplyToNewRow = () => { };
        this.sourceTable = args.sourceTable;
    }
}
