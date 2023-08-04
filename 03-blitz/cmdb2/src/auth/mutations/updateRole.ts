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
import utils, { ChangeAction, CreateChangeContext } from "shared/utils"

const contextDesc = "updateRoleMutation";

export default resolver.pipe(
    resolver.zod(UpdateRoleSchema),
    resolver.authorize(contextDesc, Permission.admin_auth),
    async ({ id, ...data }, ctx) => {
        try {
            const oldValues = await db.role.findFirst({ where: { id } });
            const obj = await db.role.update({
                where: { id },
                data: {
                    name: data.name,//
                    description: data.description,//
                }
            });

            await utils.RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext(contextDesc),
                table: "role",
                pkid: id,
                oldValues,
                newValues: obj,
                ctx,
            });

            return obj;
        } catch (e) {
            console.error(`Exception while updating role ${id}: ${data?.name}`);
            console.error(e);
            throw (e);
        }
    }
);
