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

            const songs = await db.song.findMany({
                select: {
                    id: true,
                    name: true,
                }
            });

            const events = await db.event.findMany({
                select: {
                    id: true,
                    name: true,
                }
            });

            const eventSegments = await db.eventSegment.findMany({
                select: {
                    id: true,
                    eventId: true,
                    name: true,
                }
            });

            const eventSonglists = await db.eventSongList.findMany({
                select: {
                    id: true,
                    eventId: true,
                    name: true,
                }
            });

            return {
                tableNames,
                users,
                songs,
                events,
                eventSegments,
                eventSonglists,
            };

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



