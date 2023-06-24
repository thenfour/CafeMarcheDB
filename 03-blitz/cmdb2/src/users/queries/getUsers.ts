import { paginate } from "blitz";
import { Ctx } from "blitz"
import db, { Prisma } from "db";
import { resolver } from "@blitzjs/rpc";

interface GetUsersInput
    extends Pick<
        Prisma.UserFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }


export default resolver.pipe(
    resolver.authorize(),
    async ({ where, orderBy, skip = 0, take = 100 }: GetUsersInput) => {
        // TODO: in multi-tenant app, you must add validation to ensure correct tenant
        const {
            items: users,
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
                    //include: { choices: true },
                }),
        });

        return {
            users,
            nextPage,
            hasMore,
            count,
        };
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
