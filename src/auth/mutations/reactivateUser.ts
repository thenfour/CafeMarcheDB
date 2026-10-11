import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "@/src/auth/server/activityLog";
import { Permission } from "shared/permissions";
import { cmauthorize } from "../server/cmResolver";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { requireCanManageUser } from "../server/userManagementPolicy";
import { findUserManagementActor, findUserManagementTargetByPublicId } from "../server/userManagementState";
import { revokeUserSignInState } from "../server/signInMethods";

export default resolver.pipe(
    resolver.zod(z.object({ userId: UserPublicIdSchema }).strict()),
    cmauthorize({ permission: Permission.manage_global_users, requireUser: true }),
    async ({ userId }, ctx) => db.$transaction(async tx => {
        const [actor, target] = await Promise.all([
            findUserManagementActor(tx, ctx.session.userId),
            findUserManagementTargetByPublicId(tx, userId),
        ]);
        if (!target) throw new NotFoundError();
        requireCanManageUser({ actor, target, action: "reactivate" });

        await tx.user.update({ where: { id: target.principal.id }, data: { isDeleted: false } });
        // Restoration never revives old login sessions.
        await revokeUserSignInState(tx, target.principal.id);
        await RegisterChange({
            action: ChangeAction.update,
            changeContext: CreateChangeContext("reactivateUser"),
            table: "User",
            pkid: target.principal.id,
            oldValues: { isDeleted: true },
            newValues: { isDeleted: false },
            auth: ctx.auth,
            db: tx,
        });
        return { userId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
