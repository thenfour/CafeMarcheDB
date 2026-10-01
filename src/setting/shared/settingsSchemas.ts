import { z } from "zod";

// SETTING
export const SettingNameSchema = z.string().min(1);
export const SettingValueSchema = z.string(); // allow empty strings

export const GetSettingSchema = z.object({
    name: z.string().min(1)
}); // by name


export const UpdateSettingSchema = z.object({
    name: SettingNameSchema,
    value: z.string().nullable(),
});

export const CreateSettingSchema = z.object({
    name: SettingNameSchema,
    value: z.string(),
});

export const UpdateBulkSettingsSchema = z.array(UpdateSettingSchema);
