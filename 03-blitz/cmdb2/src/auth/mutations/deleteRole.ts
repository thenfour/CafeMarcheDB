import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc"
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    CreateRole as CreateRoleSchema,
    UpdateRole as UpdateRoleSchema,
    DeleteRole as DeleteRoleSchema,
    GetObjectByIdSchema,
} from "../schemas"
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.zod(DeleteRoleSchema),
    resolver.authorize("DeleteRoleSchema", Permission.admin_auth),
    async ({ id }, ctx) => {
        try {
            const choice = await db.role.deleteMany({ where: { id } });
            // todo: register in change log.
            return choice;
        } catch (e) {
            console.error(`Exception while deleting role ${id}`);
            console.error(e);
            throw (e);
        }
    }
);

