import { resolver } from "@blitzjs/rpc";
import db from "db";
import { UpdateUserFromGrid } from "../schemas"
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"

export default resolver.pipe(
    resolver.zod(UpdateUserFromGrid),
    resolver.authorize("adminUpdateUser", Permission.admin_users),
    async ({ id, ...data }, ctx) => {
        try {
            const oldValues = await db.user.findFirst({ where: { id } });
            const obj = await db.user.update({
                where: { id },
                data,
            });

            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("adminUpdateUser"),
                table: "user",
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

