import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import type { IAuthorization } from "src/auth/shared/cmAuthorization";
import { kGlobalSettingsRegistry } from "./globalSettingsRegistry";
import { kBandSettingsRegistry } from "./bandSettingsRegistry";
import { kUserSettingsRegistry } from "./userSettingsRegistry";
import { kBandUserSettingsRegistry } from "./bandUserSettingsRegistry";
import type { RegistryCapabilities, RegistryKey, RegistryValueOf } from "./registryHelpers";
import type { SettingDefinition } from "./settingsHelpers";

export const settingsRegistries = {
    global: kGlobalSettingsRegistry, band: kBandSettingsRegistry,
    user: kUserSettingsRegistry, bandUser: kBandUserSettingsRegistry
};
export type SettingsHive = keyof typeof settingsRegistries;
export type SettingsRegistry<H extends SettingsHive> = typeof settingsRegistries[H];
export type SettingsKey<H extends SettingsHive> = RegistryKey<SettingsRegistry<H>>;
export type SettingsValue<H extends SettingsHive, K extends SettingsKey<H>> = RegistryValueOf<SettingsRegistry<H>, K>;

export interface SettingsAccessContext extends Pick<IAuthorization, "hasPermission"> {
    readonly hasUser: boolean;
    readonly hasBand: boolean;
    readonly hasMembership: boolean;
}

export function getSettingDefinition(hive: SettingsHive, key: string): SettingDefinition<z.ZodTypeAny> {
    // Hives contain different schemas. Runtime lookup validates a key before using its schema.
    const registry: Readonly<Record<string, SettingDefinition<z.ZodTypeAny>>> = settingsRegistries[hive];
    if (!Object.prototype.hasOwnProperty.call(registry, key)) {
        throw new Error(`Unknown ${hive} setting: ${key}`);
    }
    return registry[key]!;
}

export function getSettingCapabilities(hive: SettingsHive, key: string, context: SettingsAccessContext): RegistryCapabilities {
    const definition = getSettingDefinition(hive, key);
    const scopeAvailable = hive === "global" || hive === "band" && context.hasBand
        || hive === "user" && context.hasUser || hive === "bandUser" && context.hasMembership;
    const readPermission = definition.readPermission === undefined
        ? (hive === "user" || hive === "bandUser" ? Permission.login : null) : definition.readPermission;
    const writePermission = definition.writePermission ?? (hive === "global" ? Permission.manage_global_settings
        : hive === "band" ? Permission.manage_band_settings : Permission.login);
    const canView = scopeAvailable && (readPermission === null || context.hasPermission(readPermission));
    return { canView, canEdit: canView && context.hasPermission(writePermission) };
}

export interface SettingSnapshot {
    readonly value: Prisma.JsonValue;
    readonly source: "stored" | "default";
    readonly capabilities: RegistryCapabilities;
}
// Runtime keys are registry-validated; this dictionary holds transport values of mixed schemas.
export type SettingsHiveSnapshot = Readonly<Record<string, SettingSnapshot>>;
export type SettingsSnapshot = { readonly [H in SettingsHive]: SettingsHiveSnapshot };

export function readSettingSnapshot<H extends SettingsHive, K extends SettingsKey<H>>(
    settings: SettingsSnapshot, hive: H, key: K,
): SettingsValue<H, K> {
    const entry = settings[hive][key];
    if (!entry?.capabilities.canView) throw new Error(`Setting is unavailable: ${hive}/${key}`);
    return getSettingDefinition(hive, key).schema.parse(entry.value);
}

export const SettingCommandSchema = z.object({
    hive: z.enum(["global", "band", "user", "bandUser"]),
    key: z.string().min(1),
    operation: z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("set"),
            value: z.unknown().refine(value => value !== undefined, "A value is required")
        }).strict(),
        z.object({
            kind: z.literal("reset")
        }).strict(),
    ]),
}).strict();

export interface SettingCommand {
    readonly hive: SettingsHive;
    readonly key: string;
    readonly operation: {
        readonly kind: "set";
        readonly value: unknown
    } | {
        readonly kind: "reset"
    };
}

export function decodeSettingStorage(hive: SettingsHive, key: string, stored: string | Prisma.JsonValue): Prisma.JsonValue {
    // this is the result of an inconsistent schema. the actual fix here is to fix the schema!
    const raw = hive === "global" || hive === "band" ? JSON.parse(String(stored)) : stored;
    return getSettingDefinition(hive, key).schema.parse(raw);
}
