import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc"
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import utils, { ChangeAction } from "shared/utils"

import {
    DeletePermission as DeletePermissionSchema,
} from "../schemas"
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.zod(DeletePermissionSchema),
    resolver.authorize("deletePermission", Permission.admin_auth),
    async ({ id }, ctx) => {
        try {

            const oldValues = await db.permission.findFirst({ where: { id } });

            const choice = await db.permission.deleteMany({ where: { id } });

            await utils.RegisterChange({
                action: ChangeAction.delete,
                context: "deletePermission",
                table: "permission",
                pkid: id,
                oldValues: oldValues,
                ctx,
            });

            return choice;
        } catch (e) {
            console.error(`Exception while deleting permission ${id}`);
            console.error(e);
            throw (e);
        }
    }
);

