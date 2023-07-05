import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc"
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    UpdatePermission as UpdatePermissionSchema,
} from "../schemas"

export default resolver.pipe(
    resolver.zod(UpdatePermissionSchema),
    resolver.authorize(),
    async ({ id, ...data }, ctx) => {
        try {
            // TODO: do permissions check
            const obj = await db.permission.update({
                where: { id },
                data: {
                    name: data.name,//
                    description: data.description,//
                }
            });
            // todo: register in change log.
            return obj;
        } catch (e) {
            console.error(`Exception while updating permission ${id}: ${data?.name}`);
            console.error(e);
            throw (e);
        }
    }
);
