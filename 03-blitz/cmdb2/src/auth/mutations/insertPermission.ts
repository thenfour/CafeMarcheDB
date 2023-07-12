import { resolver } from "@blitzjs/rpc";
import db from "db";
import { CreatePermission as CreatePermissionSchema } from "../schemas";
import { Permission } from "shared/permissions";
import utils, { ChangeAction } from "shared/utils"

export default resolver.pipe(
    resolver.zod(CreatePermissionSchema),
    resolver.authorize("createPermission", Permission.admin_auth),
    async (fields, ctx) => {
        try {
            const obj = await db.permission.create({
                data: fields,
            });

            await utils.RegisterChange({
                action: ChangeAction.insert,
                context: "insertPermission",
                table: "permission",
                pkid: obj.id,
                newValues: fields,
                ctx,
            });

            return obj;
        } catch (e) {
            console.error(`Exception while creating permission ${fields?.name}`);
            console.error(e);
            throw (e);
        }
    }
);
