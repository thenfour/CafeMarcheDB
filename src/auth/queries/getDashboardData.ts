import { generateToken, hash256 } from "@blitzjs/auth";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Stopwatch } from "shared/rootroot";
import { getServerStartState } from "shared/serverStateBase";
import { arraysContainSameValues } from "shared/utils";
import { EventStatusSignificance, xMenuLink, xTableClientUsageContext } from "src/core/db3/db3";
import { DB3QueryCore2 } from "src/core/db3/server/db3QueryCore";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";


async function RefreshSessionPermissions(ctx: AuthenticatedCtx) {
    const publicData = { ...ctx.session?.$publicData };
    if (!publicData?.userId) return false;

    // only query if x seconds has elapsed since last fetch
    const now = new Date().getTime();
    const lastRefreshedAt = new Date(publicData.permissionsLastRefreshedAt || 0).getTime();
    const tenSeconds = 10000; // 10 seconds in milliseconds
    if (now - lastRefreshedAt < tenSeconds) {
        return false;
    }

    // get current permissions.
    const u = await db.user.findFirst({
        where: {
            id: publicData.userId
        },
        include: {
            role: {
                include: {
                    permissions: {
                        include: {
                            permission: true,
                        }
                    }
                }
            }
        }
    });
    await ctx.session.$setPublicData({
        permissionsLastRefreshedAt: new Date().toISOString(),
        GOOGLE_ANALYTICS_ID_BACKSTAGE: process.env.GOOGLE_ANALYTICS_ID_BACKSTAGE,
        GOOGLE_ANALYTICS_ID_PUBLIC: process.env.GOOGLE_ANALYTICS_ID_PUBLIC,
    });

    // ensure user has an access token.
    if (u && !u.accessToken) {
        // generateToken is secure but generates a string like 
        // CcT0mEYj6_cck9Zf7yUmi_CmoyLv-fVB
        // with underscores, mix of upper/lower, dashes...
        // hash256 returns a cleaner string. 64 chars, all hexlike.
        // combining them for the best of both worlds.
        const tok = hash256(generateToken()).toLowerCase();
        await db.user.update({
            where: {
                id: publicData.userId
            },
            data: {
                accessToken: tok,
            }
        });
    }

    // refresh session publicdata permissions
    const newPerms = u?.role?.permissions.map(p => p.permission.name);
    if (newPerms && publicData.permissions && (newPerms.length !== publicData.permissions?.length)) {
        if (!arraysContainSameValues(publicData.permissions, newPerms)) {
            await ctx.session.$setPublicData({
                showAdminControls: publicData.showAdminControls || false,
                //userId: publicData.userId,
                impersonatingFromUserId: publicData.impersonatingFromUserId,
                isSysAdmin: u?.isSysAdmin || false,
                permissions: newPerms,
            });
            return true;
        }
    }

    return false;
}






async function getTopRelevantEvents(eventStatuses: Prisma.EventStatusGetPayload<{}>[], limit: number, db: TransactionalPrismaClient): Promise<number[]> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setDate(now.getDate() - 1);

    const formatDate = (date: Date) =>
        date.toISOString().slice(0, 19).replace("T", " ");

    const nowFormatted = formatDate(now);
    const sevenDaysFromNowFormatted = formatDate(sevenDaysFromNow);
    const twentyFourHoursAgoFormatted = formatDate(twentyFourHoursAgo);

    const cancelledStatusIds = eventStatuses.filter(s => s.significance === EventStatusSignificance.Cancelled).map(s => s.id).join(", ");

    const query = `
    WITH ClassifiedEvents AS (
      SELECT
        id,
        startsAt,
        CASE 
          WHEN startsAt <= '${nowFormatted}' AND (endDateTime IS NULL OR endDateTime >= '${nowFormatted}') THEN 1 -- Ongoing
          WHEN startsAt >= '${nowFormatted}' AND startsAt <= '${sevenDaysFromNowFormatted}' THEN 2 -- Upcoming
          WHEN endDateTime IS NOT NULL AND endDateTime >= '${twentyFourHoursAgoFormatted}' AND endDateTime <= '${nowFormatted}' THEN 3 -- Recent past
          ELSE 4 -- Default/Unclassified (optional, for events that don't fit the criteria)
        END AS relevance_class
      FROM Event
      where statusId NOT IN (${cancelledStatusIds})
    )
    SELECT id
    FROM ClassifiedEvents
    WHERE relevance_class IN (1, 2, 3) -- Filter to relevant events
    ORDER BY
      relevance_class ASC, -- Primary sorting by relevance
      startsAt ASC
    LIMIT ${limit};
    
    `;

    const events = (await db.$queryRaw(Prisma.raw(query))) as { id: number }[];
    const ret = events.map(e => e.id);
    return ret;
}





export default resolver.pipe(
    async (args, ctx: AuthenticatedCtx) => {
        try {
            const sw = new Stopwatch();

            const currentUser = await getCurrentUserCore(ctx);
            const clientIntention: xTableClientUsageContext = { intention: !!currentUser ? 'user' : "public", mode: 'primary', currentUser };

            const menuItemsCall = DB3QueryCore2({
                filter: { items: [] },
                clientIntention,
                cmdbQueryContext: "getDashboardData/menulinks",
                tableID: xMenuLink.tableID,
                tableName: xMenuLink.tableName,
                orderBy: undefined,
            }, currentUser);

            const eventStatus = await db.eventStatus.findMany();

            const relevantEventsCall = getTopRelevantEvents(eventStatus, 5, db as any /* Excessive stack depth comparing types 'PrismaClient<PrismaClientOptions, unknown, InternalArgs> & EnhancedPrismaClientAddedMethods' and 'TransactionalPrismaClient' */);

            const results = await Promise.all([
                db.userTag.findMany(),
                db.permission.findMany(),
                db.role.findMany(),
                db.rolePermission.findMany(),
                db.eventType.findMany(),
                //db.eventStatus.findMany(),
                db.eventTag.findMany(),
                db.eventAttendance.findMany(),
                db.fileTag.findMany(),
                db.instrument.findMany({ include: { instrumentTags: true } }),
                db.instrumentTag.findMany(),
                db.instrumentFunctionalGroup.findMany(),
                db.songTag.findMany(),
                db.songCreditType.findMany(),
                menuItemsCall,
                db.eventCustomField.findMany(),
                relevantEventsCall,
            ]);

            const rsp = await RefreshSessionPermissions(ctx);

            const [
                userTag,
                permission,
                role,
                rolePermission,
                eventType,
                //eventStatus,
                eventTag,
                eventAttendance,
                fileTag,
                instrument,
                instrumentTag,
                instrumentFunctionalGroup,
                songTag,
                songCreditType,
                dynMenuLinks,
                eventCustomField,
                relevantEventIds,
            ] = results;

            const ret = {
                userTag,
                permission,
                role,
                rolePermission,
                eventType,
                eventStatus,
                eventTag,
                eventAttendance,
                fileTag,
                instrument,
                instrumentTag,
                instrumentFunctionalGroup,
                songTag,
                songCreditType,
                dynMenuLinks: dynMenuLinks.items as Prisma.MenuLinkGetPayload<{ include: { createdByUser } }>[],
                eventCustomField,
                sessionPermissionsChanged: rsp,
                serverStartupState: getServerStartState(),
                relevantEventIds,
            };
            if (process.env.NODE_ENV === "development") {
                sw.loghelper("total", ret);
            }
            return ret;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



