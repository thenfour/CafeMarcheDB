import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc"
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"
import { DeletePermission as DeletePermissionSchema, } from "../schemas"
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.zod(DeletePermissionSchema),
    resolver.authorize("deletePermissionMutation", Permission.admin_auth),
    async ({ id }, ctx) => {
        try {
            const oldValues = await db.permission.findFirst({ where: { id } });

            const choice = await db.permission.deleteMany({ where: { id } });

            await RegisterChange({
                action: ChangeAction.delete,
                changeContext: CreateChangeContext("deletePermissionMutation"),
                table: "permission",
                pkid: id,
                oldValues: oldValues,
                ctx,
            });

            return choice;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);

