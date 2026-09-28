import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { SignInMethodSchema } from "../signInMethodSchemas";
import { addSignInMethod, recordSignInMethodChange, requireSignInMethodAdmin } from "../server/signInMethods";
import { xUserSignInMethod } from "src/core/db3/shared/schema/userSignInMethod";
import { UserPublicIdSchema } from "../schemas";
import { requireSignInMethodTargetByPublicId } from "../server/signInMethods";

export default resolver.pipe(
    resolver.zod(z.object({ userId: UserPublicIdSchema, method: SignInMethodSchema }).strict()),
    resolver.authorize(Permission.sysadmin),
    async ({ userId, method }, ctx) => db.$transaction(async tx => {
        await requireSignInMethodAdmin(tx, ctx);
        const user = await requireSignInMethodTargetByPublicId(tx, userId);

        let displayId: string; // if new methods are added, this line may need to be updated to determine the correct displayId based on the method type
        switch (method.type) {
            case "google":
                displayId = method.identifier; // temp val until they sign in and this gets updated
                break;
            case "email":
                displayId = method.identifier;
                break;
        }

        const added = await addSignInMethod(tx, user.id, method, displayId);
        await recordSignInMethodChange(tx, ctx, user.id, added, "added");
        return { publicId: xUserSignInMethod.parseIdentity(added.publicId) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
