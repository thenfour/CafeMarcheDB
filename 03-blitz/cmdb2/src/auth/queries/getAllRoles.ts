import { resolver } from "@blitzjs/rpc";
import db from "db";

export default resolver.pipe(
    resolver.authorize(),
    async () => {
        // TODO: do permissions check
        try {
            const items = await db.role.findMany({
                include: { permissions: { include: { permission: true } } }
            });
            return items;
        } catch (e) {
            console.error(`Exception while querying roles`);
            console.error(e);
            throw (e);
        }
    }
);



