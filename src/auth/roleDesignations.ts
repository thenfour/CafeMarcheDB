import { z } from "zod";

export const RoleDesignation = {
    newUsers: "newUsers",
    public: "public",
    sysadmin: "sysadmin",
} as const;

export type RoleDesignationValue = typeof RoleDesignation[keyof typeof RoleDesignation];

export const SetRoleDesignationInput = z.object({
    designation: z.enum([RoleDesignation.newUsers, RoleDesignation.public, RoleDesignation.sysadmin]),
    roleId: z.number().int().positive(),
});
