import type { BandPublicId } from "shared/publicId";
import { z } from "zod";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { xSetlistPlan, xSetlistPlanGroup } from "./schema/setlistPlan";
import { xUser } from "./schema/user";
import { ZSetlistPlan, type SetlistPlan } from "./setlistPlanTypes";

const bandPublicId = BandPublicIdSchema;
const editablePlan = ZSetlistPlan.pick({
    publicId: true,
    name: true,
    description: true,
    groupId: true,
    payload: true,
    visiblePermissionId: true
});

export const ZSaveSetlistPlanArgs = z.object({
    bandPublicId,
    plan: editablePlan
}).strict();
export type SaveSetlistPlanArgs = z.infer<typeof ZSaveSetlistPlanArgs>;

/** Clipboard documents include metadata; saves send only editable fields. */
export function makeSetlistPlanSaveArgs(band: BandPublicId, plan: SetlistPlan): SaveSetlistPlanArgs {
    return {
        bandPublicId: band, plan: {
            publicId: plan.publicId,
            name: plan.name,
            description: plan.description,
            groupId: plan.groupId ?? null,
            payload: plan.payload,
            visiblePermissionId: plan.visiblePermissionId,
        }
    };
}

export const ZListSetlistPlansArgs = z.object({
    bandPublicId,
    // Null explicitly requests all visible plans in the band, including plans without an author.
    userId: xUser.identitySchema.nullable(),
}).strict();
export type ListSetlistPlansArgs = z.infer<typeof ZListSetlistPlansArgs>;

export const ZDeleteSetlistPlanArgs = z.object({ bandPublicId, publicId: xSetlistPlan.identitySchema }).strict();
export type DeleteSetlistPlanArgs = z.infer<typeof ZDeleteSetlistPlanArgs>;

export const ZReorderSetlistPlansArgs = z.discriminatedUnion("kind", [
    z.object({
        bandPublicId,
        kind: z.literal("group"),
        movingPublicId: xSetlistPlanGroup.identitySchema,
        newPositionPublicId: xSetlistPlanGroup.identitySchema,
        scopePublicIds: z.array(xSetlistPlanGroup.identitySchema).min(1).max(1000),
    }).strict(),
    z.object({
        bandPublicId,
        kind: z.literal("plan"),
        movingPublicId: xSetlistPlan.identitySchema,
        newPositionPublicId: xSetlistPlan.identitySchema,
        scopePublicIds: z.array(xSetlistPlan.identitySchema).min(1).max(1000),
        groupId: xSetlistPlanGroup.identitySchema.nullable(),
    }).strict(),
]);
export type ReorderSetlistPlansArgs = z.infer<typeof ZReorderSetlistPlansArgs>;
