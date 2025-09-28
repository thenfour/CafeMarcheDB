import { resolver } from "@blitzjs/rpc";
import db from "db";

export default resolver.pipe(
    async (args, ctx) => {
        try {
            // find settings that begin with "Dashboard_"
            const item = await db.setting.findMany({
                where: { name: { startsWith: "Dashboard_" } },
            });

            return Object.fromEntries(item.map(x => [x.name, x.value]));

        } catch (e) {
            console.error(`Exception while getting dashboard settings`);
            console.error(e);
            throw (e);
        }

    }
);
