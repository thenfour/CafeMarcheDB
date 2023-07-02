import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    GetObjectByNullableIdSchema
} from "../schemas";

//  QUERIES  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export default resolver.pipe(
    resolver.zod(GetObjectByNullableIdSchema),
    resolver.authorize(),
    async ({ id }) => {
        // TODO: in multi-tenant app, you must add validation to ensure correct tenant
        // TODO: do permissions check
        if (id == null) return null;
        try {
            const item = await db.role.findFirst({
                where: { id },
                include: { permissions: { include: { permission: true } } }
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
