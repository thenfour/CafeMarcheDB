import { Prisma } from "db";
import { z } from "zod";
import { defineLegacyCrudView } from "../../core/db3CrudView";
import { defineEntity } from "../../core/db3Entity";
import { xSetting } from "../../db3schema";

export const settingEntity = defineEntity<Prisma.SettingDelegate>()({
    schema: xSetting,
    getIdentity: (setting: Prisma.SettingGetPayload<{}>) => setting.id,
});

const SettingEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    value: z.string().optional(),
});

export const settingEditorView = defineLegacyCrudView({
    viewID: "Setting_Editor",
    entity: settingEntity,
    operations: { create: true, update: true },
    dtoSchema: SettingEditorDtoSchema,
    hydrate: dto => dto,
});
