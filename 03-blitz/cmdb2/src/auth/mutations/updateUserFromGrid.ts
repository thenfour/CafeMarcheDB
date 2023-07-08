import { resolver } from "@blitzjs/rpc";
import db from "db";
import { UpdateUserFromGrid } from "../schemas"

export default resolver.pipe(
    resolver.zod(UpdateUserFromGrid),
    resolver.authorize("an argUpdateUserFromGrid"),
    async ({ id, ...data }, ctx) => {
        // TODO: in multi-tenant app, you must add validation to ensure correct tenant
        const obj = await db.user.update({
            where: { id },
            data,
        });

        return obj;
    }
);

