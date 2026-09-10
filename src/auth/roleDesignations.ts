import { z } from "zod";

export const RoleDesignation = {
    newUsers: "newUsers",
    public: "public",
} as const;

export type RoleDesignationValue = typeof RoleDesignation[keyof typeof RoleDesignation];

export const SetRoleDesignationInput = z.object({
    designation: z.enum([RoleDesignation.newUsers, RoleDesignation.public]),
    roleId: z.number().int().positive(),
});
