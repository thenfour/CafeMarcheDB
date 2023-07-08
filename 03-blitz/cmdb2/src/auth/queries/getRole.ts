import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db from "db";
import { GetObjectByNullableIdSchema } from "../schemas";
import { Permission } from "shared/permissions";


export default resolver.pipe(
    resolver.zod(GetObjectByNullableIdSchema),
    resolver.authorize("getRole", Permission.view_roles),
    async ({ id }, ctx) => {
        if (id == null) return null;
        try {
            const item = await db.role.findFirst({
                where: { id },
                include: { permissions: { include: { permission: true } } },
            });
            if (!item) throw new NotFoundError();
            return item;
        } catch (e) {
            console.error(`Exception while getting role ${id}`);
            console.error(e);
            throw (e);
        }

    }
);
