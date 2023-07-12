import { resolver } from "@blitzjs/rpc";
import db from "db";
import { CreateRole as CreateRoleSchema } from "../schemas";
import { Permission } from "shared/permissions";
import utils, { ChangeAction } from "shared/utils"



export default resolver.pipe(
    resolver.zod(CreateRoleSchema),
    resolver.authorize("createRole", Permission.admin_auth),
    async (fields, ctx) => {
        try {
            const obj = await db.role.create({
                data: fields,
            });

            await utils.RegisterChange({
                action: ChangeAction.insert,
                context: "insertRole",
                table: "role",
                pkid: obj.id,
                newValues: obj,
                ctx,
            });

            return obj;
        } catch (e) {
            console.error(`Exception while creating role ${fields?.name}`);
            console.error(e);
            throw (e);
        }
    }
);
