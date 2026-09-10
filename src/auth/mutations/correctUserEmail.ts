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
import { requireActualSysadmin } from "../server/actualSysadmin";
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
            // A role-carried sysadmin grant is not sufficient. Verify the
            // persisted exceptional flag before revealing whether a target
            // account exists.
            await requireActualSysadmin(tx, ctx.session.userId);

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
                actor: { id: ctx.session.userId, isSysAdmin: true },
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
            await tx.session.deleteMany({ where: { userId } });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("correctUserEmail"),
                table: "User",
                pkid: userId,
                // Record that an identity change occurred without retaining
                // either login identifier in change history.
                oldValues: { loginEmailChanged: false },
                newValues: { loginEmailChanged: true },
                ctx,
                db: tx,
            });

            return { userId, email };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
