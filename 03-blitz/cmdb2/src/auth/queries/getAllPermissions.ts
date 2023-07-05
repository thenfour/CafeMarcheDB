import { resolver } from "@blitzjs/rpc";
import db from "db";

// NO PERMISSION CHECK BECAUSE THIS IS RUN AT STARTUP WITHOUT ANY USER CONTEXT

export default resolver.pipe(
    async ({ }, ctx) => {
        try {
            const items = await db.permission.findMany({
                include: { roles: { include: { role: true } } }
            });
            return items;
        } catch (e) {
            console.error(`Exception while querying permissions`);
            console.error(e);
            throw (e);
        }
    }
);



