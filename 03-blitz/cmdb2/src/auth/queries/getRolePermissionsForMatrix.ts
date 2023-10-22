import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    GetObjectByIdSchema
} from "../schemas";
import { Permission } from "shared/permissions";

interface QueryInput
    extends Pick<
        Prisma.PermissionFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.authorize(Permission.view_roles),
    async ({ where, orderBy, skip = 0, take = 100 }: QueryInput, ctx) => {
        try {
            const roles = await db.role.findMany({});

            const {
                items: permissions,
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
                        // this is a bit redundant. but simplifies accessing this data in the grid.
                        include: { roles: { include: { role: true, permission: true } } },
                    }),
            });

            // what the matrix grid editor needs is a struct per row, where each column is a field.
            const rows = permissions.map(permission => {
                const ret = { id: permission.id, name: permission.name };
                for (let i = 0; i < roles.length; ++i) {
                    const role = roles[i]!;
                    // the object stored under this field is the association payload, or null.
                    ret[role.id] = permission.roles.find(rp => rp.permissionId === permission.id && rp.roleId == role.id) || null;
                }
                return ret;
            });

            return {
                rows,
                columns: roles,
                nextPage,
                hasMore,
                count,
            };
        } catch (e) {
            console.error(`Exception while querying roles for role-permission matrix`);
            console.error(e);
            throw (e);
        }
    }
);



