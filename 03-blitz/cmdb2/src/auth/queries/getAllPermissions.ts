import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";


interface QueryParams
    extends Pick<
        Prisma.PermissionFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }


export default resolver.pipe(
    resolver.authorize("getAllPermissions", Permission.view_permissions),
    async (params: QueryParams, ctx) => {
        try {
            const items = await db.permission.findMany({
                ...params,
                include: { roles: { include: { role: true } } }
            });
            debugger;
            return items;
        } catch (e) {
            console.error(`Exception while querying permissions`);
            console.error(e);
            throw (e);
        }
    }
);



