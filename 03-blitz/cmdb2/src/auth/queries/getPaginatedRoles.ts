import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    GetObjectByIdSchema
} from "../schemas";
import { Permission } from "shared/permissions";

interface GetRolesInput
    extends Pick<
        Prisma.RoleFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.authorize(Permission.view_roles),
    async ({ where, orderBy, skip = 0, take = 100 }: GetRolesInput, ctx) => {
        try {
            const {
                items,
                hasMore,
                nextPage,
                count,
            } = await paginate({
                skip,
                take,
                count: () => db.role.count({ where }),
                query: (paginateArgs) =>
                    db.role.findMany({
                        ...paginateArgs,
                        where,
                        orderBy,
                        include: { permissions: { include: { permission: true } } },
                    }),
            });

            return {
                items,
                nextPage,
                hasMore,
                count,
            };
        } catch (e) {
            console.error(`Exception while querying roles`);
            console.error(e);
            throw (e);
        }
    }
);



