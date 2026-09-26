import { resolver } from "@/src/auth/server/cmResolver";
import type { CMCtx } from "@/src/auth/server/cmResolver";
import { paginate } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";

interface GetInput__
    extends Pick<
        Prisma.SettingFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.cmauthorize(Permission.sysadmin),
    async ({ where, orderBy, skip, take }: GetInput__, ctx: CMCtx) => {
        try {
            (await ctx.auth.refresh(db)).requirePermission(Permission.sysadmin);
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



