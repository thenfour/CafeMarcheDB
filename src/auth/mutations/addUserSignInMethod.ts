import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { SignInMethodSchema } from "../signInMethodSchemas";
import { addSignInMethod, recordSignInMethodChange, requireSignInMethodAdmin, requireSignInMethodTarget } from "../server/signInMethods";
import { xUserSignInMethod } from "src/core/db3/shared/schema/userSignInMethod";

export default resolver.pipe(
    resolver.zod(z.object({ userId: z.number().int().positive(), method: SignInMethodSchema }).strict()),
    resolver.authorize(Permission.sysadmin),
    async ({ userId, method }, ctx) => db.$transaction(async tx => {
        await requireSignInMethodAdmin(tx, ctx);
        await requireSignInMethodTarget(tx, userId);
        const added = await addSignInMethod(tx, userId, method);
        await recordSignInMethodChange(tx, ctx, userId, added, "added");
        return { publicId: xUserSignInMethod.parseIdentity(added.publicId) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
