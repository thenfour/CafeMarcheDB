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

export default resolver.pipe(
    resolver.zod(DeleteRoleSchema),
    resolver.authorize("an arg DeleteRoleSchema"),
    async ({ id }, ctx) => {
        try {
            // TODO: do permissions check
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

