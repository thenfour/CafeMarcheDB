import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import type { ClientOf } from "../../core/db3View";
import { xSetlistPlanGroup } from "../../schema/setlistPlan";

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
    entity: xSetlistPlanGroup,
    operations: { create: true, update: true, delete: true },
    dtoSchema: SetlistPlanGroupEditorDtoSchema,
    hydrate: dto => xSetlistPlanGroup.getClientModel(dto, "view"),
});

export type SetlistPlanGroupEditorClient = ClientOf<typeof setlistPlanGroupEditorView>;
