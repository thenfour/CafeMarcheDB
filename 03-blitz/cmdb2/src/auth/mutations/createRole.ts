import { resolver } from "@blitzjs/rpc";
import db from "db";
import { CreateRole as CreateRoleSchema } from "../schemas";
import { Permission } from "shared/permissions";



export default resolver.pipe(
    resolver.zod(CreateRoleSchema),
    resolver.authorize("createRole", Permission.admin_auth),
    async (fields, ctx) => {
        try {
            const obj = await db.role.create({
                data: fields,
            });

            // todo: register in change log.

            return obj;
        } catch (e) {
            console.error(`Exception while creating role ${fields?.name}`);
            console.error(e);
            throw (e);
        }
    }
);
