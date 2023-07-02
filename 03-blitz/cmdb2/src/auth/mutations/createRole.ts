import { resolver } from "@blitzjs/rpc";
import db from "db";
import { CreateRole as CreateRoleSchema } from "../schemas";



export default resolver.pipe(
    resolver.zod(CreateRoleSchema),
    async (fields, ctx) => {
        try {
            // TODO: do permissions check
            // if (!ctx.session.roles.includes("admin")) {
            //     throw new Error("You don't have permission to create a role.");
            //   }

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
