import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { paginate } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { requireFreshPermission } from "../server/permissionAuthorization";

interface GetInput__
    extends Pick<
        Prisma.SettingFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async ({ where, orderBy, skip, take }: GetInput__, ctx: AuthenticatedCtx) => {
        try {
            await requireFreshPermission(db, ctx.session.userId, Permission.sysadmin);
            const {
                items,
                hasMore,
                nextPage,
                count,
            } = await paginate({
                skip,
                take,
                maxTake: 1000, // apparently prevents overload when take is user input.
                count: () => db.setting.count({ where }),
                query: (paginateArgs) =>
                    db.setting.findMany({
                        ...paginateArgs,
                        where,
                        orderBy,
                    }),
            });

            return {
                items,
                nextPage,
                hasMore,
                count,
            };
        } catch (e) {
            console.error(`Exception while querying setting`);
            console.error(e);
            throw (e);
        }
    }
);



