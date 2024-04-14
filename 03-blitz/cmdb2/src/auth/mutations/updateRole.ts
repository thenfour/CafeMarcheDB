import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils";
import {
    UpdateRole as UpdateRoleSchema
} from "../schemas";

const contextDesc = "updateRoleMutation";

export default resolver.pipe(
    resolver.zod(UpdateRoleSchema),
    resolver.authorize(Permission.sysadmin),
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

            await RegisterChange({
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
