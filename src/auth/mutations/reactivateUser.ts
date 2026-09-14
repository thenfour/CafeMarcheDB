import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { requireCanManageUser } from "../server/userManagementPolicy";
import { findActiveUserManagementPrincipal, findUserManagementPrincipal } from "../server/userManagementState";
import { revokeUserSignInState } from "../server/signInMethods";

export default resolver.pipe(
    resolver.zod(z.object({ userId: z.number().int().positive() }).strict()),
    resolver.authorize(Permission.recover_users),
    async ({ userId }, ctx) => db.$transaction(async tx => {
        const [actor, target] = await Promise.all([
            findActiveUserManagementPrincipal(tx, ctx.session.userId),
            findUserManagementPrincipal(tx, userId),
        ]);
        if (!target) throw new NotFoundError();
        requireCanManageUser({ actor, target, action: "reactivate" });

        await tx.user.update({ where: { id: userId }, data: { isDeleted: false } });
        // Restoration never revives old login sessions.
        await revokeUserSignInState(tx, userId);
        await RegisterChange({
            action: ChangeAction.update,
            changeContext: CreateChangeContext("reactivateUser"),
            table: "User",
            pkid: userId,
            oldValues: { isDeleted: true },
            newValues: { isDeleted: false },
            ctx,
            db: tx,
        });
        return { userId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
