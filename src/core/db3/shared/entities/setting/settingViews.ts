import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
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

const settingEditorSelection = Prisma.validator<Prisma.SettingDefaultArgs>()({
    select: {
        id: true,
        name: true,
        value: true,
    },
});

export const settingEditorView = defineCrudView({
    viewID: "Setting_Editor",
    entity: settingEntity,
    operations: { create: true, update: true },
    selection: settingEditorSelection,
    dtoSchema: SettingEditorDtoSchema,
    hydrate: dto => dto,
});
