import { Prisma } from "db";
import { QuickSearchItemType } from "shared/quickFilter";
import { z } from "zod";


///////////// setlist planning /////////////////////////////////////////////////////////////////

// matches MatchingSlugItem on purpose.
export const ZSetlistPlanAssociatedItem = z.object({
    itemType: z.enum(["song", "event", "user", "wikiPage"]).transform((val) => val as QuickSearchItemType),
    name: z.string(),
    absoluteUri: z.string().optional(),
    id: z.number(),
});

export type SetlistPlanAssociatedItem = z.infer<typeof ZSetlistPlanAssociatedItem>;

export const ZSetlistPlanLedDef = z.object({
    ledId: z.string(),
    name: z.string(),
    descriptionMarkdown: z.string().optional(),
    staticLabel: z.string().optional(), // for all instances of this LED, use this text caption always.
    associatedItem: ZSetlistPlanAssociatedItem.optional().nullable(),
    autoColor: z.boolean().optional(),
});

export type SetlistPlanLedDef = z.infer<typeof ZSetlistPlanLedDef>;

export const ZSetlistPlanLedValue = z.object({
    ledId: z.string(),
    color: z.string().nullable().optional(),
    text: z.string().optional(), // per LED
});

export type SetlistPlanLedValue = z.infer<typeof ZSetlistPlanLedValue>;

export const ZSetlistPlanRow = z.object({
    rowId: z.string(),
    songId: z.number().optional(),
    pointsRequired: z.number().optional(),
    commentMarkdown: z.string().optional(),
    color: z.string().nullable().optional(),
    type: z.enum(["song", "divider"]),
    leds: z.array(ZSetlistPlanLedValue).optional(),
});

export type SetlistPlanRow = z.infer<typeof ZSetlistPlanRow>;

export const ZSetlistPlanColumn = z.object({
    columnId: z.string(),
    pointsAvailable: z.number().optional(),
    color: z.string().nullable().optional(),
    name: z.string(),
    commentMarkdown: z.string().optional(),
    leds: z.array(ZSetlistPlanLedValue).optional(),
    associatedItem: ZSetlistPlanAssociatedItem.optional().nullable(),
});

export type SetlistPlanColumn = z.infer<typeof ZSetlistPlanColumn>;

export const ZSetlistPlanCell = z.object({
    columnId: z.string(),
    rowId: z.string(),
    pointsAllocated: z.number().optional(),
    commentMarkdown: z.string().optional(),
    autoFilled: z.boolean().optional(),
});

export type SetlistPlanCell = z.infer<typeof ZSetlistPlanCell>;

export const ZSetlistPlanPayload = z.object({
    version: z.literal(1), // breaking changes add new version (1 || 2 || 3 etc)
    rows: z.array(ZSetlistPlanRow),
    columns: z.array(ZSetlistPlanColumn),
    cells: z.array(ZSetlistPlanCell),
    notes: z.string().optional(),

    columnLeds: z.array(ZSetlistPlanLedDef).optional(),
    rowLeds: z.array(ZSetlistPlanLedDef).optional(),

    autoCompleteMaxPointsPerRehearsal: z.number().optional(),
    autoCompleteIterations: z.number().optional(),
    autoCompleteDepth: z.number().optional(),
    autoCompleteDurationSeconds: z.number().optional(),

    // for getNeighbors' behavior, we need to track where autocomplete has been.
    //emptyTopRowIndex: z.number().optional(),
    //emptyLeftRowIndex: z.number().optional(),
});

// corresponds to the payloadJson field in the db
export type SetlistPlanPayload = z.infer<typeof ZSetlistPlanPayload>;

export const ZSetlistPlan = z.object({
    id: z.number(), // negative = new
    name: z.string(),
    description: z.string(),
    createdByUserId: z.number(),
    payload: ZSetlistPlanPayload,
});

export type SetlistPlan = z.infer<typeof ZSetlistPlan>;

// doesn't serialize to db.
export const CreateNewSetlistPlan = (id: number, name: string, createdByUserId: number): SetlistPlan => {
    //if (!dashboardContext.currentUser) throw new Error("must be logged in to create a new setlist plan");
    return {
        id,
        createdByUserId,
        name,
        description: "",
        payload: {
            version: 1,
            rows: [],
            columns: [],
            cells: [],
        },
    };
};

export const DeserializeSetlistPlan = (obj: Prisma.SetlistPlanGetPayload<{}>): SetlistPlan => {
    let payload: SetlistPlanPayload = {
        version: 1,
        rows: [],
        columns: [],
        cells: [],
    };
    try {
        payload = ZSetlistPlanPayload.parse(JSON.parse(obj.payloadJson));
    } catch (e) {
        console.error(e);
    }
    return {
        createdByUserId: obj.createdByUserId,
        description: obj.description,
        id: obj.id,
        name: obj.name,
        payload,
    };
}


