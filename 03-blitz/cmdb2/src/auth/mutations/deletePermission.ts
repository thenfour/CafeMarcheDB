import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc"
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    DeletePermission as DeletePermissionSchema,
} from "../schemas"

export default resolver.pipe(
    resolver.zod(DeletePermissionSchema),
    resolver.authorize(),
    async ({ id }, ctx) => {
        try {
            // TODO: do permissions check
            const choice = await db.permission.deleteMany({ where: { id } });
            // todo: register in change log.
            return choice;
        } catch (e) {
            console.error(`Exception while deleting permission ${id}`);
            console.error(e);
            throw (e);
        }
    }
);

