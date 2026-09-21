import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import type { ClientOf } from "../../core/db3View";
import { setlistPlanGroupEntity } from "./setlistPlanEntities";

const SetlistPlanGroupEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string(),
    description: z.string(),
    color: z.string().nullable(),
    sortOrder: z.number().int(),
    createdByUserId: z.number().int(),
    createdAt: z.date(),
});

export const setlistPlanGroupEditorView = defineCrudView({
    viewID: "SetlistPlanGroup_Editor",
    entity: setlistPlanGroupEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: SetlistPlanGroupEditorDtoSchema,
    hydrate: dto => setlistPlanGroupEntity.schema.getClientModel(dto, "view"),
});

export type SetlistPlanGroupEditorClient = ClientOf<typeof setlistPlanGroupEditorView>;
