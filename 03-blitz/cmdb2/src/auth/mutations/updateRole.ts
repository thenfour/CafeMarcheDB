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
    resolver.zod(UpdateRoleSchema),
    resolver.authorize("updateRole", Permission.admin_auth),
    async ({ id, ...data }, ctx) => {
        try {
            const obj = await db.role.update({
                where: { id },
                data: {
                    name: data.name,//
                    description: data.description,//
                }
            });
            // todo: register in change log.
            return obj;
        } catch (e) {
            console.error(`Exception while updating role ${id}: ${data?.name}`);
            console.error(e);
            throw (e);
        }
    }
);
