import { resolver } from "@blitzjs/rpc"
import { GetObjectByIdSchema } from "../schemas"
import db from "db";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"

export default resolver.pipe(
    resolver.zod(GetObjectByIdSchema),
    resolver.authorize("SoftDeleteUserMutation", Permission.admin_users),
    async ({ id }, ctx) => {
        try {

            const oldValues = await db.user.findFirst({ where: { id } });

            const obj = await db.user.update({
                where: { id },
                data: {
                    isDeleted: true,
                }
            });

            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("SoftDeleteUserMutation"),
                table: "user",
                pkid: id!,
                oldValues,
                newValues: obj,
                ctx,
            });

            return obj;
        } catch (e) {
            console.error(`Exception while soft-deleting user ${id}`);
            console.error(e);
            throw (e);
        }
    }
);

