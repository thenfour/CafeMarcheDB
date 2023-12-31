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
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"

export default resolver.pipe(
    resolver.zod(DeleteRoleSchema),
    resolver.authorize(Permission.sysadmin),
    async ({ id }, ctx) => {
        try {

            const oldValues = await db.role.findFirst({ where: { id } });

            const choice = await db.role.deleteMany({ where: { id } });

            await RegisterChange({
                action: ChangeAction.delete,
                changeContext: CreateChangeContext("deleteRoleMutation"),
                table: "role",
                pkid: id,
                oldValues,
                ctx,
            });


            return choice;
        } catch (e) {
            console.error(`Exception while deleting role ${id}`);
            console.error(e);
            throw (e);
        }
    }
);

