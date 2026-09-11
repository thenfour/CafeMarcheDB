import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { requireFreshPermission } from "../server/permissionAuthorization";


interface QueryParams
    extends Pick<
        Prisma.RoleFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }


export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (params: QueryParams, ctx) => {
        try {
            await requireFreshPermission(db, ctx.session.userId, Permission.sysadmin);
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



