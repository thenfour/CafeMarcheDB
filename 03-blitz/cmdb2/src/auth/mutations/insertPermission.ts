import { resolver } from "@blitzjs/rpc";
import db from "db";
import { CreatePermission as CreatePermissionSchema } from "../schemas";

export default resolver.pipe(
    resolver.zod(CreatePermissionSchema),
    async (fields, ctx) => {
        try {
            // TODO: do permissions check
            // if (!ctx.session.roles.includes("admin")) {
            //     throw new Error("You don't have permission to create a role.");
            //   }

            const obj = await db.permission.create({
                data: fields,
            });

            // todo: register in change log.

            return obj;
        } catch (e) {
            console.error(`Exception while creating permission ${fields?.name}`);
            console.error(e);
            throw (e);
        }
    }
);
