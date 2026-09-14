import { z } from "zod";

// Add preferences here: persistence, validation, defaults and consumer types
// all use this registry. Names are literal keys; dots group related settings.
export const userSettingDefinitions = {
    "calendar.showDeclinedEvents": {
        schema: z.boolean(),
        defaultValue: true,
    },
    "calendar.showUninvitedEvents": {
        schema: z.boolean(),
        defaultValue: true,
    },
} as const;

// extracts the zod schemas by key.
type SettingSchemas = {
    [K in keyof typeof userSettingDefinitions]: typeof userSettingDefinitions[K]["schema"];
};

// the whole user settings zod schema.
export const UserSettingsSchema = z.object(
    Object.fromEntries(
        Object.entries(userSettingDefinitions)
            .map(([name, definition]) => [name, definition.schema]),
    ) as SettingSchemas
).strict();

export const UserSettingsPatchSchema = UserSettingsSchema.partial();
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type UserSettingsPatch = z.infer<typeof UserSettingsPatchSchema>;

export const resolveUserSettings = (
    rows: readonly { name: string; value: unknown }[] = [],
): UserSettings => {
    const stored = new Map(rows.map(row => [row.name, row.value]));
    return UserSettingsSchema.parse(Object.fromEntries(
        Object.entries(userSettingDefinitions).map(([name, definition]) => {
            const parsed = definition.schema.safeParse(stored.get(name));
            // Missing, obsolete and invalid stored preferences cannot prevent
            // loading the dashboard. Writes strictly validate known keys.
            return [name, parsed.success ? parsed.data : definition.defaultValue];
        }),
    ));
};
