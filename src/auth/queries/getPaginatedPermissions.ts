import { resolver } from "@blitzjs/rpc";
import { paginate } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";

interface GetPermissionsInput
    extends Pick<
        Prisma.PermissionFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async ({ where, orderBy, skip = 0, take = 100 }: GetPermissionsInput, ctx) => {
        try {
            const {
                items,
                hasMore,
                nextPage,
                count,
            } = await paginate({
                skip,
                take,
                count: () => db.permission.count({ where }),
                query: (paginateArgs) =>
                    db.permission.findMany({
                        ...paginateArgs,
                        where,
                        orderBy,
                        include: { roles: { include: { role: true } } },
                    }),
            });

            return {
                items,
                nextPage,
                hasMore,
                count,
            };
        } catch (e) {
            console.error(`Exception while querying permission`);
            console.error(e);
            throw (e);
        }
    }
);



