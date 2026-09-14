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

            const target = await tx.user.findFirst({
                select: {
                    id: true,
                    email: true,
                    isDeleted: true,
                    isSysAdmin: true,
                },
                where: { id: userId },
            });
            if (!target) throw new NotFoundError();

            requireCanManageUser({
                actor: { ...actor, role: { permissions: actor.effectivePermissionNames.map(name => ({ permission: { name } })) } },
                target,
                action: "correctEmail",
            });

            if (target.email === email) {
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
