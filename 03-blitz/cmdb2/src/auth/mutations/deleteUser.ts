import { resolver } from "@blitzjs/rpc"
import { GetObjectByIdSchema } from "../schemas"
import db from "db";
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.zod(GetObjectByIdSchema),
    resolver.authorize("SoftDeleteUser", Permission.admin_users),
    async ({ id }, ctx) => {
        try {
            const obj = await db.user.update({
                where: { id },
                data: {
                    isDeleted: true,
                }
            });

            // todo: register in change log.
            return obj;
        } catch (e) {
            console.error(`Exception while soft-deleting user ${id}`);
            console.error(e);
            throw (e);
        }
    }
);

