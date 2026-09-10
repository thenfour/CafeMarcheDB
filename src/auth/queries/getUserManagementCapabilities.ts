import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import { z } from "zod";
import { getUserManagementCapabilities } from "../server/userManagementPolicy";

const GetUserManagementCapabilitiesInput = z.object({
    userId: z.number().int().positive(),
});

export default resolver.pipe(
    resolver.zod(GetUserManagementCapabilitiesInput),
    resolver.authorize(Permission.admin_users),
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
        return getUserManagementCapabilities(actor, target);
    },
);
