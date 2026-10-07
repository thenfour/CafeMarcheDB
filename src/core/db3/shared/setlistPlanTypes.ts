import type { Nullish } from "@/shared/rootroot";
import { Prisma } from "db";
import { QuickSearchItemType } from "shared/quickFilter";
import { isPublicId, type PermissionPublicId, type SetlistPlanGroupPublicId, type UserPublicId } from "shared/publicId";
import { z } from "zod";
import * as db3 from "../db3";


///////////// setlist planning /////////////////////////////////////////////////////////////////

// matches MatchingSlugItem on purpose.
const SetlistPlanAssociatedItemBase = {
    name: z.string(),
    absoluteUri: z.string().optional(),
};
export const ZSetlistPlanAssociatedItem = z.discriminatedUnion("itemType", [
    z.object({
        ...SetlistPlanAssociatedItemBase,
        itemType: z.literal(QuickSearchItemType.event),
        id: db3.xEvent.identitySchema
    }),
    z.object({
        ...SetlistPlanAssociatedItemBase,
        itemType: z.literal(QuickSearchItemType.song),
        id: db3.xSong.identitySchema
    }),
    z.object({
        ...SetlistPlanAssociatedItemBase,
        itemType: z.literal(QuickSearchItemType.user),
        id: db3.xUser.identitySchema
    }),
    z.object({
        ...SetlistPlanAssociatedItemBase,
        itemType: z.literal(QuickSearchItemType.wikiPage),
        id: db3.xWikiPage.identitySchema
    }),
]);

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
    songId: db3.xSong.identitySchema.optional(),
    pointsRequired: z.number().optional(),
    commentMarkdown: z.string().optional(),
    color: z.string().nullable().optional(),
    type: z.enum(["song", "divider"]),
    leds: z.array(ZSetlistPlanLedValue).optional(),
    isInterruption: z.boolean().optional().default(true),
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
    publicId: db3.xSetlistPlan.identitySchema.nullable(),
    draftId: z.number().int().negative().optional(), // Local key for an unsaved plan.
    name: z.string(),
    groupId: db3.xSetlistPlanGroup.identitySchema.nullable().optional(),
    sortOrder: z.number().optional(),
    description: z.string(),
    createdAt: z.date(),
    createdByUserId: db3.xUser.identitySchema.nullable(),
    payload: ZSetlistPlanPayload,
    visiblePermissionId: z.custom<PermissionPublicId>(isPublicId).nullable(),
    // NOTE: Adding non-primitives (e.g. Date) here will cause issues with serialization to/from JSON.
    // make sure deserialization and paste from clipboard gets updated if you do that.
}).strict();

export type SetlistPlan = z.infer<typeof ZSetlistPlan>;

export const CopySetlistPlanPayloadWithoutDerivedStats = (payload: SetlistPlanPayload): SetlistPlanPayload => {
    const payloadWithoutDerivedStats: SetlistPlanPayload = {
        ...payload,
    };

    delete payloadWithoutDerivedStats.autoCompleteDurationSeconds;
    delete payloadWithoutDerivedStats.autoCompleteDepth;
    delete payloadWithoutDerivedStats.autoCompleteIterations;

    return payloadWithoutDerivedStats;
};

export const CreatePastedSetlistPlanPreservingMetadata = ({
    pastedPlan,
    existingPlan,
}: {
    pastedPlan: SetlistPlan;
    existingPlan: SetlistPlan;
}): SetlistPlan => {
    return {
        ...pastedPlan,
        publicId: existingPlan.publicId,
        draftId: existingPlan.draftId,
        name: existingPlan.name,
        groupId: existingPlan.groupId,
        sortOrder: existingPlan.sortOrder,
        description: existingPlan.description,
        createdAt: existingPlan.createdAt,
        createdByUserId: existingPlan.createdByUserId,
        visiblePermissionId: existingPlan.visiblePermissionId,
        // Keep the current plan identity and ownership metadata while replacing the editable plan content.
        payload: CopySetlistPlanPayloadWithoutDerivedStats(pastedPlan.payload),
    };
};

// doesn't serialize to db.
export const CreateNewSetlistPlan = (draftId: number, name: string, groupId: SetlistPlanGroupPublicId | Nullish, createdByUserId: UserPublicId): SetlistPlan => {
    //if (!dashboardContext.currentUser) throw new Error("must be logged in to create a new setlist plan");
    return {
        publicId: null,
        draftId,
        createdByUserId,
        createdAt: new Date(),
        name,
        groupId,
        description: "",
        visiblePermissionId: null,
        payload: {
            version: 1,
            rows: [],
            columns: [],
            cells: [],
        },
    };
};

export const SetlistPlanWithVisibilityArgs = Prisma.validator<Prisma.SetlistPlanDefaultArgs>()({
    include: {
        visiblePermission: {
            select: { publicId: true },
        },
        createdByUser: { select: { publicId: true } },
        group: { select: { publicId: true } },
    },
});

export type SetlistPlanWithVisibilityPayload = Prisma.SetlistPlanGetPayload<typeof SetlistPlanWithVisibilityArgs>;

export const DeserializeSetlistPlan = (obj: SetlistPlanWithVisibilityPayload): SetlistPlan => {
    let payload: SetlistPlanPayload = {
        version: 1,
        rows: [],
        columns: [],
        cells: [],
    };
    try {
        const parsed = JSON.parse(obj.payloadJson);
        payload = ZSetlistPlanPayload.parse(parsed);
    } catch (e) {
        // Keep a damaged historical document readable as an empty plan, as the editor did before migration.
        console.error(e);
    }
    return {
        createdByUserId: obj.createdByUser ? db3.xUser.parseIdentity(obj.createdByUser.publicId) : null,
        createdAt: obj.createdAt,
        description: obj.description,
        publicId: db3.xSetlistPlan.parseIdentity(obj.publicId),
        name: obj.name,
        sortOrder: obj.sortOrder,
        visiblePermissionId: obj.visiblePermission
            ? db3.xPermission.parseIdentity(obj.visiblePermission.publicId)
            : null,
        groupId: obj.group ? db3.xSetlistPlanGroup.parseIdentity(obj.group.publicId) : null,
        payload,
    };
}


