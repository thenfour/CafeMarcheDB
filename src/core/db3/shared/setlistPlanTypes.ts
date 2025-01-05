import { Prisma, PrismaClient } from "db";
import { z } from "zod";


///////////// setlist planning /////////////////////////////////////////////////////////////////

export const ZSetlistPlanSong = z.object({
    songId: z.number(),
    measureRequired: z.number().optional(),
    commentMarkdown: z.string().optional(),
});

export type SetlistPlanSong = z.infer<typeof ZSetlistPlanSong>;

export const ZSetlistPlanSegment = z.object({
    segmentId: z.number(),
    measureTotal: z.number().optional(),
    name: z.string(),
    commentMarkdown: z.string().optional(),
});

export type SetlistPlanSegment = z.infer<typeof ZSetlistPlanSegment>;

export const ZSetlistPlanSegmentSong = z.object({
    segmentId: z.number(),
    songId: z.number(),
    measureUsage: z.number().optional(),
    commentMarkdown: z.string().optional(),
});

export type SetlistPlanSegmentSong = z.infer<typeof ZSetlistPlanSegmentSong>;

export const ZSetlistPlanPayload = z.object({
    version: z.literal(1), // breaking changes add new version (1 || 2 || 3 etc)
    songs: z.array(ZSetlistPlanSong),
    segments: z.array(ZSetlistPlanSegment),
    segmentSongs: z.array(ZSetlistPlanSegmentSong),
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

export const DeserializeSetlistPlan = (obj: Prisma.SetlistPlanGetPayload<{}>): SetlistPlan => {
    return {
        createdByUserId: obj.createdByUserId,
        description: obj.description,
        id: obj.id,
        name: obj.name,
        payload: JSON.parse(obj.payloadJson),
    };
}


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
            songs: [],
            segments: [],
            segmentSongs: [],
        },
    };
};
