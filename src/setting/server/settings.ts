import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import db from "db";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { ChangeAction, RegisterChange, type ChangeContext } from "src/auth/server/activityLog";
import { generatePublicId } from "src/server/publicId";
import { reanchorAllDayEvents } from "src/server/dateTime";
import {
    validateSettingValue, getSettingCapabilities, getSettingDefinition, settingsRegistries,
    type SettingCommand, type SettingsAccessContext, type SettingsHive, type SettingsHiveSnapshot, type SettingsSnapshot
} from "../shared/settingsContract";

export type SettingsDatabase = Pick<Prisma.TransactionClient, "globalSetting" | "bandSetting" | "userSetting" | "bandUserSetting">;
// Blitz adds delegate types; settings use only the standard Prisma transaction API.
export const settingsDatabase = db as unknown as SettingsDatabase;

function settingsAccessContext(auth: CMServerAuthorization): SettingsAccessContext {
    return {
        hasUser: !!auth.user,
        hasBand: !!auth.band,
        hasMembership: !!auth.membership,
        hasPermission: permission => auth.hasPermission(permission)
    };
}

export async function loadSettingsSnapshot(database: SettingsDatabase, auth: CMServerAuthorization): Promise<SettingsSnapshot> {
    const [global, band, user, bandUser] = await Promise.all([
        database.globalSetting.findMany(),
        auth.band ? database.bandSetting.findMany({ where: { bandId: auth.band.id } }) : Promise.resolve([]),
        auth.userId ? database.userSetting.findMany({ where: { userId: auth.userId } }) : Promise.resolve([]),
        auth.membership ? database.bandUserSetting.findMany({ where: { bandUserId: auth.membership.id } }) : Promise.resolve([]),
    ]);
    const access = settingsAccessContext(auth);

    function resolveHive(hive: SettingsHive, rows: readonly { name: string; value: Prisma.JsonValue }[]): SettingsHiveSnapshot {
        return Object.fromEntries(Object.keys(settingsRegistries[hive]).flatMap(key => {
            const capabilities = getSettingCapabilities(hive, key, access);
            if (!capabilities.canView) {
                return [];
            }
            const row = rows.find(row => row.name === key);
            const value = row ? validateSettingValue(hive, key, row.value) : getSettingDefinition(hive, key).defaultValue;
            return [[
                key,
                {
                    value,
                    source: row ? "stored" : "default",
                    capabilities,
                }
            ]];
        }));
    }

    return {
        global: resolveHive("global", global), band: resolveHive("band", band),
        user: resolveHive("user", user), bandUser: resolveHive("bandUser", bandUser)
    };
}

function requireSettingWrite(auth: CMServerAuthorization, command: SettingCommand): void {
    if (!getSettingCapabilities(command.hive, command.key, settingsAccessContext(auth)).canEdit) {
        throw new AuthorizationError(`Cannot edit ${command.hive}/${command.key}.`);
    }
    if (command.hive === "band") auth.requireBand();
    if (command.hive === "user") auth.requireUser();
    if (command.hive === "bandUser") auth.requireMembership();
}

type SettingRow = {
    id: number;
    name: string;
    value: Prisma.JsonValue;
};

function toNestedJsonInput(value: Prisma.JsonValue | undefined): Prisma.InputJsonValue | null {
    if (value === undefined) throw new Error("A stored setting needs a value.");
    if (value === null) return null;
    if (Array.isArray(value)) return value.map(toNestedJsonInput);
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) =>
        [key, toNestedJsonInput(child)]));
    return value;
}

async function persistSetting(database: SettingsDatabase, auth: CMServerAuthorization, command: SettingCommand, value: Prisma.JsonValue | undefined): Promise<{ oldRow: SettingRow | null; newRow: SettingRow | null }> {
    const { hive, key: name } = command;
    const updatedByUserId = auth.userId;
    const resetting = command.operation.kind === "reset";
    const text = JSON.stringify(value);
    // Prisma uses JsonNull for a JSON null (rather than a SQL NULL).
    const json = resetting ? Prisma.JsonNull : toNestedJsonInput(value) ?? Prisma.JsonNull;
    switch (hive) {
        case "global": {
            const oldRow = await database.globalSetting.findUnique({ where: { name } });
            if (resetting) { if (oldRow) await database.globalSetting.delete({ where: { id: oldRow.id } }); return { oldRow, newRow: null }; }
            if (oldRow && JSON.stringify(oldRow.value) === text) return { oldRow, newRow: oldRow };
            const newRow = await database.globalSetting.upsert({
                where: { name },
                create: { publicId: generatePublicId<"GlobalSetting">(), name, value: json, updatedByUserId }, update: { value: json, updatedByUserId }
            });
            return { oldRow, newRow };
        }
        case "band": {
            const bandId = auth.requireBand().id;
            const where = { bandId_name: { bandId, name } };
            const oldRow = await database.bandSetting.findUnique({ where });
            if (resetting) { if (oldRow) await database.bandSetting.delete({ where: { id: oldRow.id } }); return { oldRow, newRow: null }; }
            if (oldRow && JSON.stringify(oldRow.value) === text) return { oldRow, newRow: oldRow };
            const newRow = await database.bandSetting.upsert({
                where,
                create: { publicId: generatePublicId<"BandSetting">(), bandId, name, value: json, updatedByUserId }, update: { value: json, updatedByUserId }
            });
            return { oldRow, newRow };
        }
        case "user": {
            const userId = auth.requireUser().userId;
            const where = { userId_name: { userId, name } };
            const oldRow = await database.userSetting.findUnique({ where });
            if (resetting) { if (oldRow) await database.userSetting.delete({ where: { id: oldRow.id } }); return { oldRow, newRow: null }; }
            if (oldRow && JSON.stringify(oldRow.value) === text) return { oldRow, newRow: oldRow };
            const newRow = await database.userSetting.upsert({
                where,
                create: { userId, name, value: json, updatedByUserId }, update: { value: json, updatedByUserId }
            });
            return { oldRow, newRow };
        }
        case "bandUser": {
            const bandUserId = auth.requireMembership().id;
            const where = { bandUserId_name: { bandUserId, name } };
            const oldRow = await database.bandUserSetting.findUnique({ where });
            if (resetting) { if (oldRow) await database.bandUserSetting.delete({ where: { id: oldRow.id } }); return { oldRow, newRow: null }; }
            if (oldRow && JSON.stringify(oldRow.value) === text) return { oldRow, newRow: oldRow };
            const newRow = await database.bandUserSetting.upsert({
                where,
                create: { bandUserId, name, value: json, updatedByUserId }, update: { value: json, updatedByUserId }
            });
            return { oldRow, newRow };
        }
    }
}

/** Caller owns a serializable transaction and refreshes authorization inside it. */
export async function writeSettings(database: Prisma.TransactionClient, auth: CMServerAuthorization, commands: readonly SettingCommand[], changeContext: ChangeContext): Promise<void> {
    // Validate the entire batch before the first permanent write.
    const validated = commands.map(command => {
        requireSettingWrite(auth, command);
        return { command, value: command.operation.kind === "set" ? getSettingDefinition(command.hive, command.key).schema.parse(command.operation.value) : undefined };
    });
    for (const { command, value } of validated) {
        const { oldRow, newRow } = await persistSetting(database, auth, command, value);
        if ((!oldRow && !newRow) || oldRow === newRow) {
            continue;
        }
        await RegisterChange({
            db: database,
            auth,
            changeContext,
            table: `${command.hive[0]!.toUpperCase()}${command.hive.slice(1)}Setting`,
            pkid: (newRow ?? oldRow)!.id,
            oldValues: oldRow,
            newValues: newRow,
            action: newRow ? oldRow ? ChangeAction.update : ChangeAction.insert : ChangeAction.delete
        });

        // TODO: consider putting this in persistSetting, so it acts more like the previous mutation hook.
        if (command.hive === "band" && command.key === "dateTime.bandTimeZone") {
            const oldZone = oldRow ? validateSettingValue("band", command.key, oldRow.value) : getSettingDefinition("band", command.key).defaultValue;
            const newZone = newRow ? validateSettingValue("band", command.key, newRow.value) : getSettingDefinition("band", command.key).defaultValue;
            await reanchorAllDayEvents(database, String(oldZone), String(newZone), auth.requireBand().id);
        }
    }
}
