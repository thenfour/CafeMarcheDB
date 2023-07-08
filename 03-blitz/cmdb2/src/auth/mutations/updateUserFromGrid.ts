import { resolver } from "@blitzjs/rpc";
import db from "db";
import { UpdateUserFromGrid } from "../schemas"
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.zod(UpdateUserFromGrid),
    resolver.authorize("adminUpdateUser", Permission.admin_users),
    async ({ id, ...data }, ctx) => {
        try {
            const obj = await db.user.update({
                where: { id },
                data,
            });
            // todo: register in change log.
            return obj;
        } catch (e) {
            console.error(`Exception while updating role ${id}: ${data?.name}`);
            console.error(e);
            throw (e);
        }
    }
);

