export const PUBLIC_ID_LENGTH = 16;
export const PUBLIC_ID_PLACEHOLDER_PREFIX = "~";

const PublicIdPattern = /^[A-Za-z0-9_-]{16}$/;

declare const publicIdBrand: unique symbol;

export type PublicId<TTable extends string = string> = string & {
    readonly [publicIdBrand]: TTable;
};

export type InstrumentFunctionalGroupPublicId = PublicId<"InstrumentFunctionalGroup">;
// todo: define other table-specific public ID types as needed here.

export function isPublicId(value: unknown): value is PublicId {
    return typeof value === "string" && PublicIdPattern.test(value);
}

export function parsePublicId<TTable extends string = string>(value: unknown): PublicId<TTable> {
    if (!isPublicId(value)) {
        throw new Error(`Expected a ${PUBLIC_ID_LENGTH}-character public ID.`);
    }
    return value as PublicId<TTable>;
}
