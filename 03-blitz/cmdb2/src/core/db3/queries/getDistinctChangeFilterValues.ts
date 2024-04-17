import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { AuthenticatedCtx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";
import * as mutationCore from "../server/db3mutationCore"
import { TAnyModel } from "shared/utils";

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (input: {}, ctx: AuthenticatedCtx) => {
        try {
            const tableNames: { tableName: string }[] = await db.$queryRaw`
    SELECT DISTINCT [table] as tableName
    FROM Change;
`;

            // circumvent soft deletion etc.
            const users = await db.user.findMany({
                select: {
                    id: true,
                    name: true,
                    email: true,
                }
            });
            return {
                tableNames,
                users,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



