import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";


interface QueryParams
    extends Pick<
        Prisma.RoleFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }


export default resolver.pipe(
    resolver.authorize(),
    async (params: QueryParams, ctx) => {
        // TODO: do permissions check
        try {
            const items = await db.role.findMany({
                ...params,
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


