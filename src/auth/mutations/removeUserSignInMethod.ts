import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { recordSignInMethodChange, requireSignInMethodAdmin, requireSignInMethodTarget } from "../server/signInMethods";

export default resolver.pipe(
    resolver.zod(z.object({ userId: z.number().int().positive(), methodId: z.number().int().positive() }).strict()),
    resolver.authorize(Permission.sysadmin),
    async ({ userId, methodId }, ctx) => db.$transaction(async tx => {
        await requireSignInMethodAdmin(tx, ctx);
        const user = await requireSignInMethodTarget(tx, userId);
        const methods = await tx.userSignInMethod.findMany({ where: { userId } });
        const method = methods.find(item => item.id === methodId);
        if (!method) throw new NotFoundError();
        const hasRemainingMethod = methods.some(item => item.id !== methodId
            && (item.type === "google" || !!user.hashedPassword));
        if (!user.isDeleted && !hasRemainingMethod) {
            throw new Error("Add a usable replacement before removing the last sign-in method of an active user.");
        }
        await tx.userSignInMethod.delete({ where: { id: methodId } });
        await recordSignInMethodChange(tx, ctx, userId, method, "removed");
        return { id: methodId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
