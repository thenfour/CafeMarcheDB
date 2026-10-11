import { z } from "zod";
import { isPublicId, type GlobalRolePublicId, type BandRolePublicId } from "shared/publicId";

export const RoleDesignation = {
    newUsers: "newUsers",
    public: "public",
    sysadmin: "sysadmin",
} as const;

export type RoleDesignationValue = typeof RoleDesignation[keyof typeof RoleDesignation];

export const SetRoleDesignationInput = z.discriminatedUnion("scope", [
    z.object({
        scope: z.literal("global"),
        designation: z.literal(RoleDesignation.sysadmin),
        roleId: z.custom<GlobalRolePublicId>(isPublicId)
    }).strict(),
    z.object({
        scope: z.literal("band"),
        designation: z.enum([RoleDesignation.newUsers, RoleDesignation.public]),
        roleId: z.custom<BandRolePublicId>(isPublicId)
    }).strict(),
]);
export type SetRoleDesignation = z.infer<typeof SetRoleDesignationInput>;
