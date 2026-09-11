import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { requireFreshPermission } from "../server/permissionAuthorization";


interface QueryParams
    extends Pick<
        Prisma.PermissionFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }


export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (params: QueryParams, ctx) => {
        try {
            await requireFreshPermission(db, ctx.session.userId, Permission.sysadmin);
            const items = await db.permission.findMany({
                ...params,
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



