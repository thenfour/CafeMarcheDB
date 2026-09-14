import { resolver } from "@blitzjs/rpc";
import db from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { requireSignInMethodAdmin, requireSignInMethodTarget } from "../server/signInMethods";

export default resolver.pipe(
    resolver.zod(z.object({ userId: z.number().int().positive() }).strict()),
    resolver.authorize(Permission.sysadmin),
    async ({ userId }, ctx) => {
        await requireSignInMethodAdmin(db, ctx);
        const user = await requireSignInMethodTarget(db, userId);
        const methods = await db.userSignInMethod.findMany({ where: { userId }, orderBy: { id: "asc" } });
        return {
            methods: methods.map(({ id, type, identifier, createdAt }) => ({ id, type, identifier, createdAt })),
            hasPassword: !!user.hashedPassword,
        };
    },
);
