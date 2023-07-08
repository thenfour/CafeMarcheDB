import { paginate } from "blitz";
import { Ctx } from "blitz"
import db, { Prisma } from "db";
import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";

interface GetUsersInput
    extends Pick<
        Prisma.UserFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }


export default resolver.pipe(
    resolver.authorize("getUsers", Permission.view_all_user_data),
    async ({ where, orderBy, skip = 0, take = 100 }: GetUsersInput, ctx) => {
        try {
            const {
                items,
                hasMore,
                nextPage,
                count,
            } = await paginate({
                skip,
                take,
                count: () => db.user.count({ where }),
                query: (paginateArgs) =>
                    db.user.findMany({
                        ...paginateArgs,
                        where,
                        orderBy,
                        include: { role: true },
                    }),
            });

            return {
                items,
                nextPage,
                hasMore,
                count,
            };
        } catch (e) {
            console.error(`Exception / GetPaginatedUsers`);
            console.error(e);
            throw (e);
        }
    }
);



// export default async function getUsers(_ = null, { session }: Ctx) {
//   if (!session.userId) return null

//   const user = await db.user.findFirst({
//     where: { id: session.userId },
//     select: {
//       id: true,
//       name: true,
//       email: true,
//       role: true
//     },
//   })

//   return user
// }
