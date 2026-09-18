import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    ChangeAction,
    CreateChangeContext,
    RegisterChange,
} from "shared/activityLog";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserEmailSchema } from "../schemas";
import { requireSignInMethodAdmin } from "../server/signInMethods";
import { requireCanManageUser } from "../server/userManagementPolicy";
import { findUserManagementTarget, makeUserManagementActor } from "../server/userManagementState";

export const CorrectUserEmailInput = z.object({
    userId: z.number().int().positive(),
    email: UserEmailSchema,
});

export default resolver.pipe(
    resolver.zod(CorrectUserEmailInput),
    resolver.authorize(Permission.sysadmin),
    async ({ userId, email }, ctx) => db.$transaction(
        async tx => {
            // Re-read effective Sysadmin authority before revealing whether
            // a target account exists.
            const actor = await requireSignInMethodAdmin(tx, ctx);

            const target = await findUserManagementTarget(tx, userId);

            if (!target) throw new NotFoundError();

            requireCanManageUser({
                actor: makeUserManagementActor(actor, actor.effectivePermissions),
                target,
                action: "correctEmail",
            });

            if (target.principal.email === email) {
                return { userId, email };
            }

            await tx.user.update({
                where: { id: userId },
                data: { email },
            });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("correctUserEmail"),
                table: "User",
                pkid: userId,
                // Record the contact correction without retaining either address.
                oldValues: { contactEmailChanged: false },
                newValues: { contactEmailChanged: true },
                ctx,
                db: tx,
            });

            return { userId, email };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
