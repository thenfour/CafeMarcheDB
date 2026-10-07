import type { LocalizedStringFormat, Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import type { z } from "zod";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { LocalizedFieldEditSchema } from "../shared/dynamicStringWrite";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import { generatePublicId } from "src/server/publicId";
import { normalizeLocaleTag } from "../shared/localePreferences";

export type DynamicStringWriterDatabase = Pick<Prisma.TransactionClient, "dynamicLocalizedString" | "dynamicLocalizedStringValue" | "bandDynamicLocalizedStringValue" | "locale" | "change">;

export async function requireBandWriteLocale(database: DynamicStringWriterDatabase, auth: CMServerAuthorization, tag: string) {
    const locale = await database.locale.findFirst({
        where: {
            ietfTag: normalizeLocaleTag(tag), isDeleted: false, bandLocales: { some: { bandId: auth.requireBand().id } },
        }
    });
    if (!locale) throw new Error("Choose an enabled band locale for this translation.");
    return locale;
}

export function encodeDynamicStringValue(format: LocalizedStringFormat, value: string) {
    if (format === "PlainText" && value.length > 768) {
        throw new Error("Plain text translations must fit the indexed value column.");
    }
    return format === "PlainText" ? { indexedValue: value, blobValue: null } : { indexedValue: null, blobValue: value };
}

/** Catalog commands authorize the owning field; clients cannot choose its storage scope or string identity. */
export async function writeGlobalDynamicString(database: DynamicStringWriterDatabase, auth: CMServerAuthorization,
    ownedStringId: number | null, format: LocalizedStringFormat, edit: z.infer<typeof LocalizedFieldEditSchema>,
): Promise<number> {
    const current = ownedStringId === null ? null : await database.dynamicLocalizedString.findUniqueOrThrow({ where: { id: ownedStringId } });
    if ((current?.publicId ?? null) !== edit.stringPublicId) {
        throw new AuthorizationError("The string identity does not belong to this entity field.");
    }
    if (current && current.format !== format) {
        throw new Error("The string format does not match this entity field.");
    }
    if (edit.kind === "inherit") {
        throw new Error("Global catalog fields have no value to inherit.");
    }
    const locale = await database.locale.findFirst({ where: { ietfTag: normalizeLocaleTag(edit.localeTag), isDeleted: false } });
    if (!locale) {
        throw new Error("Choose an enabled global locale for this translation.");
    }
    const storage = encodeDynamicStringValue(format, edit.value);
    const identity = current ?? await database.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format } });
    const key = { localeId: locale.id, stringId: identity.id };
    const oldValue = await database.dynamicLocalizedStringValue.findUnique({ where: { localeId_stringId: key } });
    if (oldValue && oldValue.indexedValue === storage.indexedValue && oldValue.blobValue === storage.blobValue) {
        return identity.id;
    }
    const newValue = await database.dynamicLocalizedStringValue.upsert({
        where: { localeId_stringId: key },
        create: {
            ...key,
            ...storage,
            publicId: generatePublicId(),
            updatedByUserId: auth.userId
        },
        update: {
            ...storage,
            updatedByUserId: auth.userId
        },
    });
    await RegisterChange({
        db: database,
        auth,
        changeContext: CreateChangeContext("global localized field"),
        table: "DynamicLocalizedStringValue",
        pkid: newValue.id,
        action: oldValue ? ChangeAction.update : ChangeAction.insert,
        oldValues: oldValue,
        newValues: newValue,
    });
    return identity.id;
}

/** The entity writer supplies the owned ID from its authorized row, inside its transaction. */
export async function writeBandDynamicString(database: DynamicStringWriterDatabase, auth: CMServerAuthorization,
    ownedStringId: number | null, format: LocalizedStringFormat, edit: z.infer<typeof LocalizedFieldEditSchema>,
): Promise<number | null> {
    const current = ownedStringId === null ? null : await database.dynamicLocalizedString.findUniqueOrThrow({ where: { id: ownedStringId } });
    if ((current?.publicId ?? null) !== edit.stringPublicId) {
        throw new AuthorizationError("The string identity does not belong to this entity field.");
    }
    if (current && current.format !== format) {
        throw new Error("The string format does not match this entity field.");
    }
    if (edit.kind === "inherit") {
        return null;
    }
    const locale = await requireBandWriteLocale(database, auth, edit.localeTag);
    const storage = encodeDynamicStringValue(format, edit.value);
    const identity = current ?? await database.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format } });
    const key = { bandId: auth.requireBand().id, localeId: locale.id, stringId: identity.id };
    const oldValue = await database.bandDynamicLocalizedStringValue.findUnique({ where: { stringId_localeId_bandId: key } });
    if (oldValue && oldValue.indexedValue === storage.indexedValue && oldValue.blobValue === storage.blobValue) {
        return identity.id;
    }
    const newValue = await database.bandDynamicLocalizedStringValue.upsert({
        where: { stringId_localeId_bandId: key },
        create: {
            ...key,
            ...storage,
            publicId: generatePublicId(),
            updatedByUserId: auth.userId,
        },
        update: {
            ...storage,
            updatedByUserId: auth.userId,
        },
    });
    await RegisterChange({
        db: database,
        auth,
        changeContext: CreateChangeContext("band localized field"),
        table: "BandDynamicLocalizedStringValue",
        pkid: newValue.id,
        action: oldValue ? ChangeAction.update : ChangeAction.insert,
        oldValues: oldValue, newValues: newValue
    });
    return identity.id;
}
