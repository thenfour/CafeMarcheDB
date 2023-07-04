import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    GetObjectByIdSchema
} from "../schemas";

interface GetRolesInput
    extends Pick<
        Prisma.RoleFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.authorize(),
    async ({ where, orderBy, skip = 0, take = 100 }: GetRolesInput, ctx) => {
        // TODO: in multi-tenant app, you must add validation to ensure correct tenant
        // TODO: do permissions check
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
                    db.role.findMany({ ...paginateArgs, where, orderBy }),
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



