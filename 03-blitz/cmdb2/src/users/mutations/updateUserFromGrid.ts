import { resolver } from "@blitzjs/rpc";
import db from "db";
import { UpdateUserFromGrid } from "../../auth/schemas"

export default resolver.pipe(
    resolver.zod(UpdateUserFromGrid),
    resolver.authorize(),
    async ({ id, ...data }, ctx) => {
        // TODO: in multi-tenant app, you must add validation to ensure correct tenant
        const obj = await db.user.update({
            where: { id },
            data,
        });

        return obj;
    }
);

