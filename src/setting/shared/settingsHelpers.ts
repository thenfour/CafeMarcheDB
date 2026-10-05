import { z } from "zod";
import { RegistryEntryWithoutKey, registryEntry } from "./registryHelpers";

// ---- settings registry helpers...
// while tempting to add auth maps per setting, it's just complex and (so far) unnecessary.
// that would largely replicate auth stuff from db3 xtable, which is a pretty sophisticated system.
// so basically if we need per-setting auth, use customauth in xtable.
export type SettingDefinition<TZodSchema extends z.ZodTypeAny> = RegistryEntryWithoutKey<TZodSchema>;

export type BooleanSettingDefinition = SettingDefinition<z.ZodBoolean>;
export type StringSettingDefinition = SettingDefinition<z.ZodString> & {
    stringFormat: "plain" | "markdown";
};

// ----------------------------------------------------------------------------------------------

export const DefaultValueOfSetting = <T extends SettingDefinition<z.ZodTypeAny>>(setting: T): T["defaultValue"] => {
    return setting.defaultValue;
};

// Usage: ValueOfSetting<typeof kUserSettingsRegistry["calendar.showDeclinedEvents"]>.
export type ValueOfSetting<T extends SettingDefinition<z.ZodTypeAny>> = z.infer<T["schema"]>;

// ----------------------------------------------------------------------------------------------
export function booleanSetting<const T extends BooleanSettingDefinition>(definition: T) {
    return registryEntry(definition);
}

export function stringSetting<const T extends StringSettingDefinition>(definition: T) {
    return registryEntry(definition);
}

export type EnumSettingDefinition<T extends string> = SettingDefinition<z.ZodEnum<[T, ...T[]]>>;

export function enumSetting<const T extends EnumSettingDefinition<string>>(
    definition: T & SettingDefinition<T["schema"]>,
) {
    return registryEntry(definition);
}
