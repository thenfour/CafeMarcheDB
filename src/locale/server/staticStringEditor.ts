import type { Prisma, StaticLocalizedStringValue, BandStaticLocalizedStringValue } from "@prisma/client";
import { AuthorizationError } from "blitz";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { ChangeAction, RegisterChange, type ChangeContext } from "src/auth/server/activityLog";
import { generatePublicId } from "src/server/publicId";
import { kStaticLocalizedStringRegistry } from "../shared/staticLocalizedStringRegistry";
import {
    StaticStringTargetSchema, StaticStringWriteSchema, staticStringWritePermission,
    type StaticStringTarget, type StaticStringWrite, type StaticStringEditorData,
} from "../shared/staticStringEdit";
import { lookupStaticTranslation } from "./localization";

type StaticStringDatabase = Pick<Prisma.TransactionClient, "locale" | "staticLocalizedStringValue"
    | "bandStaticLocalizedStringValue" | "change">;
type StoredStaticTranslation = StaticLocalizedStringValue | BandStaticLocalizedStringValue;
type TranslationStorage = Pick<StaticLocalizedStringValue, "indexedValue" | "blobValue">;
type TranslationKey = Pick<StaticLocalizedStringValue, "stringKey" | "localeId">;

function requireTargetAuthority(auth: CMServerAuthorization, target: StaticStringTarget): void {
    auth.requireUser();
    auth.requirePermission(staticStringWritePermission(target.scope));
    if (target.scope === "band" && auth.requireBand().publicId !== target.bandPublicId) {
        throw new AuthorizationError("The translation belongs to another band.");
    }
}

async function findWriteLocale(database: StaticStringDatabase, auth: CMServerAuthorization, target: StaticStringTarget) {
    return database.locale.findFirst({ where: {
        ietfTag: target.localeTag,
        isDeleted: false,
        ...(target.scope === "band" ? { bandLocales: { some: { bandId: auth.requireBand().id } } } : {}),
    } });
}

export async function loadStaticStringEditor(database: StaticStringDatabase, auth: CMServerAuthorization,
    input: StaticStringTarget,
): Promise<StaticStringEditorData> {
    const target = StaticStringTargetSchema.parse(input);
    requireTargetAuthority(auth, target);
    const [value, locale] = await Promise.all([
        lookupStaticTranslation(database, auth, target.key, target.localeTag, target.scope),
        findWriteLocale(database, auth, target),
    ]);
    return { value, canSet: locale !== null };
}

function encodeRegisteredTranslation(command: StaticStringWrite): TranslationStorage {
    const { target, operation } = command;
    const definition = kStaticLocalizedStringRegistry[target.key];
    const value = operation.kind === "set" ? definition.schema.parse(operation.value) : null;
    if (value !== null && definition.format === "plain" && value.length > 768) {
        throw new Error("Plain text translations must fit the indexed value column.");
    }
    return definition.format === "markdown"
        ? { indexedValue: null, blobValue: value } : { indexedValue: value, blobValue: null };
}

function loadStoredTranslation(database: StaticStringDatabase, auth: CMServerAuthorization,
    scope: StaticStringTarget["scope"], key: TranslationKey,
): Promise<StoredStaticTranslation | null> {
    return scope === "global"
        ? database.staticLocalizedStringValue.findUnique({ where: { stringKey_localeId: key } })
        : database.bandStaticLocalizedStringValue.findUnique({ where: {
            stringKey_localeId_bandId: { ...key, bandId: auth.requireBand().id },
        } });
}

async function persistTranslation(database: StaticStringDatabase, auth: CMServerAuthorization,
    command: StaticStringWrite, key: TranslationKey, storage: TranslationStorage,
): Promise<StoredStaticTranslation | null> {
    const resetting = command.operation.kind === "reset";
    if (command.target.scope === "global") {
        if (resetting) {
            await database.staticLocalizedStringValue.delete({ where: { stringKey_localeId: key } });
            return null;
        }
        return database.staticLocalizedStringValue.upsert({ where: { stringKey_localeId: key },
            create: { ...key, ...storage, publicId: generatePublicId(), updatedByUserId: auth.userId },
            update: { ...storage, updatedByUserId: auth.userId },
        });
    }
    const bandKey = { ...key, bandId: auth.requireBand().id };
    if (resetting) {
        await database.bandStaticLocalizedStringValue.delete({ where: { stringKey_localeId_bandId: bandKey } });
        return null;
    }
    return database.bandStaticLocalizedStringValue.upsert({ where: { stringKey_localeId_bandId: bandKey },
        create: { ...bandKey, ...storage, publicId: generatePublicId(), updatedByUserId: auth.userId },
        update: { ...storage, updatedByUserId: auth.userId },
    });
}

/** The registered key owns validation and format; the selected scope owns authority and storage. */
export async function writeStaticString(database: StaticStringDatabase, auth: CMServerAuthorization,
    input: StaticStringWrite, changeContext: ChangeContext,
): Promise<void> {
    const command = StaticStringWriteSchema.parse(input);
    const { target, operation } = command;
    requireTargetAuthority(auth, target);
    const storage = encodeRegisteredTranslation(command);
    // Removing a stored override remains possible after its locale is disabled or deleted.
    const locale = operation.kind === "set" ? await findWriteLocale(database, auth, target)
        : await database.locale.findUnique({ where: { ietfTag: target.localeTag } });
    if (!locale) {
        throw new Error("Choose an enabled locale for this translation.");
    }
    const key = { stringKey: target.key, localeId: locale.id };
    const oldRow = await loadStoredTranslation(database, auth, target.scope, key);
    if (operation.kind === "reset" && !oldRow || operation.kind === "set" && oldRow
        && oldRow.indexedValue === storage.indexedValue && oldRow.blobValue === storage.blobValue) {
        return;
    }
    const newRow = await persistTranslation(database, auth, command, key, storage);
    const identity = newRow ?? oldRow;
    if (!identity) {
        throw new Error("A changed translation needs an audit identity.");
    }
    await RegisterChange({ db: database, auth, changeContext,
        table: target.scope === "global" ? "StaticLocalizedStringValue" : "BandStaticLocalizedStringValue",
        pkid: identity.id,
        action: operation.kind === "reset" ? ChangeAction.delete : oldRow ? ChangeAction.update : ChangeAction.insert,
        oldValues: oldRow ?? undefined, newValues: newRow ?? undefined,
    });
}
