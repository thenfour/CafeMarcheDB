import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (input: {}, ctx: AuthenticatedCtx) => {
        try {
            const tableNames: { tableName: string }[] = await db.$queryRaw`
    SELECT DISTINCT \`table\` as tableName
    FROM \`Change\`;
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



