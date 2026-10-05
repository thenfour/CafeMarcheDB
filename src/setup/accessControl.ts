import { LocalizedStringFormat, type Prisma, type PrismaClient } from "@prisma/client";
import { DefaultRolePermissionAssignments, DefaultRoles } from "../../shared/defaultRolePermissionAssignments";
import { getPermissionDatabaseMetadata, gPermissionRegistry } from "../../shared/permissions";
import { assertValidSysadminRole } from "../auth/server/sessionInvalidation";
import { generatePublicId } from "../server/publicId";

async function createEnglishString(
    database: Prisma.TransactionClient,
    localeId: number,
    format: LocalizedStringFormat,
    value: string,
): Promise<number> {
    const string = await database.dynamicLocalizedString.create({
        data: {
            publicId: generatePublicId<"DynamicLocalizedString">(), format,
            values: { create: {
                publicId: generatePublicId<"DynamicLocalizedStringValue">(), localeId,
                ...(format === LocalizedStringFormat.PlainText ? { indexedValue: value } : { blobValue: value }),
            } },
        },
        select: { id: true },
    });
    return string.id;
}

async function ensureLocales(database: Prisma.TransactionClient): Promise<number> {
    const definitions = [
        { ietfTag: "en-US", langCode: "en", regionCode: "US", name: "English", sortOrder: 0 },
        { ietfTag: "fr-BE", langCode: "fr", regionCode: "BE", name: "French", sortOrder: 1 },
        { ietfTag: "nl-BE", langCode: "nl", regionCode: "BE", name: "Dutch", sortOrder: 2 },
    ];
    let englishId: number | null = null;
    for (const definition of definitions) {
        let locale = await database.locale.findUnique({ where: { ietfTag: definition.ietfTag } });
        if (!locale) {
            // Create the identity first to break the locale-name/value cycle.
            const name = await database.dynamicLocalizedString.create({
                data: { publicId: generatePublicId<"DynamicLocalizedString">(), format: LocalizedStringFormat.PlainText },
            });
            const { name: _name, ...metadata } = definition;
            locale = await database.locale.create({
                data: { ...metadata, publicId: generatePublicId<"Locale">(), nameId: name.id },
            });
        }
        if (definition.ietfTag === "en-US") {
            if (locale.isDeleted) throw new Error("The English fallback locale must be active.");
            englishId = locale.id;
        }
        if (englishId === null) throw new Error("English must be initialized before localized seed values.");
        await database.dynamicLocalizedStringValue.upsert({
            where: { localeId_stringId: { localeId: englishId, stringId: locale.nameId } },
            create: {
                publicId: generatePublicId<"DynamicLocalizedStringValue">(),
                localeId: englishId, stringId: locale.nameId, indexedValue: definition.name,
            },
            update: {},
        });
    }
    if (englishId === null) throw new Error("English locale initialization failed.");
    return englishId;
}

async function synchronizePermissions(database: Prisma.TransactionClient, englishId: number): Promise<void> {
    const existing = await database.permission.findMany();
    for (const definition of gPermissionRegistry) {
        const permission = existing.find(row => row.name === definition.key);
        const { description, ...metadata } = getPermissionDatabaseMetadata(definition);
        const descriptionId = permission?.descriptionId ?? await createEnglishString(
            database, englishId, LocalizedStringFormat.Markdown, description,
        );
        if (!permission) {
            await database.permission.create({ data: {
                publicId: generatePublicId<"Permission">(), name: definition.key, descriptionId, ...metadata,
            } });
        } else if (permission.descriptionId !== descriptionId
            || permission.sortOrder !== metadata.sortOrder || permission.isVisibility !== metadata.isVisibility
            || (definition.presentation && (permission.color !== metadata.color
                || permission.iconName !== metadata.iconName || permission.significance !== metadata.significance))) {
            await database.permission.update({ where: { id: permission.id }, data: { descriptionId, ...metadata } });
        }
    }
    // Preserve unknown/deleted permissions and their history. The authorization
    // loader excludes them; retirement is an explicit migration operation.
}

async function seedRolesForFreshInstall(database: Prisma.TransactionClient, englishId: number): Promise<void> {
    const [globalCount, bandCount] = await Promise.all([database.globalRole.count(), database.bandRole.count()]);
    if (globalCount || bandCount) return;
    const roles = new Map<string, { kind: "global" | "band"; id: number }>();
    for (const definition of DefaultRoles) {
        const nameId = await createEnglishString(database, englishId, LocalizedStringFormat.PlainText, definition.name);
        const descriptionId = definition.description === null ? null : await createEnglishString(
            database, englishId, LocalizedStringFormat.Markdown, definition.description,
        );
        const metadata = {
            nameId, descriptionId, sortOrder: definition.sortOrder, color: definition.color,
            isPublicRole: definition.isPublicRole, isRoleForNewUsers: definition.isRoleForNewUsers,
        };
        if (definition.isSysAdminRole) {
            const role = await database.globalRole.create({ data: {
                ...metadata, publicId: generatePublicId<"GlobalRole">(), isSysAdminRole: true,
            } });
            roles.set(definition.name, { kind: "global", id: role.id });
        } else {
            const role = await database.bandRole.create({ data: { ...metadata, publicId: generatePublicId<"BandRole">() } });
            roles.set(definition.name, { kind: "band", id: role.id });
        }
    }
    const permissions = new Map((await database.permission.findMany()).map(permission => [permission.name, permission.id]));
    const globalGrants: Prisma.GlobalRolePermissionCreateManyInput[] = [];
    const bandGrants: Prisma.BandRolePermissionCreateManyInput[] = [];
    for (const [roleName, permissionName] of DefaultRolePermissionAssignments) {
        const role = roles.get(roleName);
        const permissionId = permissions.get(permissionName);
        if (!role || permissionId === undefined) throw new Error(`Unknown seed role/permission: ${roleName}/${permissionName}`);
        if (role.kind === "global") {
            globalGrants.push({ publicId: generatePublicId<"GlobalRolePermission">(), globalRoleId: role.id, permissionId });
        } else {
            bandGrants.push({ publicId: generatePublicId<"BandRolePermission">(), bandRoleId: role.id, permissionId });
        }
    }
    await database.globalRolePermission.createMany({ data: globalGrants });
    await database.bandRolePermission.createMany({ data: bandGrants });
}

// Startup and the seed entry point share these foundations. Catalog/demo seeds
// are adapted with their DB3 domains; startup never recreates migrated chrome.
export async function initializeAccessControl(database: Pick<PrismaClient, "$transaction">): Promise<void> {
    await database.$transaction(async transaction => {
        const englishId = await ensureLocales(transaction);
        await synchronizePermissions(transaction, englishId);
        await seedRolesForFreshInstall(transaction, englishId);
        await assertValidSysadminRole(transaction);
    }, { isolationLevel: "Serializable", timeout: 30_000 });
}
