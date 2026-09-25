import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { recordSignInMethodChange, requireSignInMethodAdmin, requireSignInMethodTarget } from "../server/signInMethods";
import { xUserSignInMethod } from "src/core/db3/shared/schema/userSignInMethod";

export default resolver.pipe(
    resolver.zod(z.object({ userId: z.number().int().positive(), methodPublicId: xUserSignInMethod.identitySchema }).strict()),
    resolver.authorize(Permission.sysadmin),
    async ({ userId, methodPublicId }, ctx) => db.$transaction(async tx => {
        await requireSignInMethodAdmin(tx, ctx);
        const user = await requireSignInMethodTarget(tx, userId);
        const methods = await tx.userSignInMethod.findMany({ where: { userId } });
        const method = methods.find(item => item.publicId === methodPublicId);
        if (!method) throw new NotFoundError();
        const hasRemainingMethod = methods.some(item => item.id !== method.id
            && (item.type === "google" || !!user.hashedPassword));
        if (!user.isDeleted && !hasRemainingMethod) {
            throw new Error("Add a usable replacement before removing the last sign-in method of an active user.");
        }
        await tx.userSignInMethod.delete({ where: { id: method.id } });
        await recordSignInMethodChange(tx, ctx, userId, method, "removed");
        return { publicId: xUserSignInMethod.parseIdentity(method.publicId) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
