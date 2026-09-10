import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import { z } from "zod";
import {
    getContinuityWarningsForUserResult,
    getUserManagementCapabilities,
} from "../server/userManagementPolicy";
import {
    findActiveNonSysadminUsers,
    getAssignableRoles,
} from "../server/userManagementState";

const GetUserManagementCapabilitiesInput = z.object({
    userId: z.number().int().positive(),
});

export default resolver.pipe(
    resolver.zod(GetUserManagementCapabilitiesInput),
    resolver.authorize(Permission.view_users_basic_info),
    async ({ userId }, ctx) => {
        const [actor, target] = await Promise.all([
            db.user.findFirst({
                ...UserWithRolesArgs,
                where: { id: ctx.session.userId },
            }),
            db.user.findFirst({
                ...UserWithRolesArgs,
                where: { id: userId },
            }),
        ]);

        if (!target) throw new NotFoundError();
        const capabilities = getUserManagementCapabilities(actor, target);
        const activeNonSysadminUsers = capabilities.canAssignRole || capabilities.canDeactivate
            ? await findActiveNonSysadminUsers(db)
            : [];

        return {
            ...capabilities,
            assignableRoles: await getAssignableRoles(
                db,
                actor,
                target,
                activeNonSysadminUsers,
            ),
            unassignedRoleContinuityWarnings: capabilities.canAssignRole
                ? getContinuityWarningsForUserResult(target, null, activeNonSysadminUsers)
                : [],
            deactivationContinuityWarnings: capabilities.canDeactivate
                ? getContinuityWarningsForUserResult(target, null, activeNonSysadminUsers)
                : [],
        };
    },
);
