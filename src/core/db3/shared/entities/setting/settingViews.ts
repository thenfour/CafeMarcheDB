import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { xSetting } from "../../db3schema";

const SettingEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    value: z.string().optional(),
});

export const settingEditorView = defineCrudView({
    viewID: "Setting_Editor",
    entity: xSetting,
    operations: { create: true, update: true },
    dtoSchema: SettingEditorDtoSchema,
    hydrate: dto => xSetting.getClientModel(dto, "view"),
});
