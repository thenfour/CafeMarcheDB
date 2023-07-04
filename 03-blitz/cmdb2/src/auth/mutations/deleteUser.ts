import { resolver } from "@blitzjs/rpc"
import { GetObjectByIdSchema } from "../schemas"
import db from "db";

export default resolver.pipe(
    resolver.zod(GetObjectByIdSchema),
    resolver.authorize(),
    async ({ id }, ctx) => {
        try {
            // TODO: do permissions check
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

