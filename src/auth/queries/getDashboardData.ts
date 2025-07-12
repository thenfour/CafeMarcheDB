import { BigintToNumber } from "@/shared/utils";
import { UserWithRolesPayload } from "@/src/core/db3/shared/schema/userPayloads";
import { generateToken, hash256 } from "@blitzjs/auth";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { arraysContainSameValues } from "shared/arrayUtils";
import { Stopwatch } from "shared/rootroot";
import { getServerStartState } from "shared/serverStateBase";
import { gEventRelevanceClass, EventStatusSignificance, gVisibleEventRelevanceClasses, xEvent, xMenuLink, xTableClientUsageContext } from "src/core/db3/db3";
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






async function getTopRelevantEvents(currentUser: UserWithRolesPayload | null, eventStatuses: Prisma.EventStatusGetPayload<{}>[], db: TransactionalPrismaClient): Promise<number[]> {
    if (!currentUser) {
        // no user, no events.
        return [];
    }
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7); // 7 days allows you to see next week's rehearsal just after the last one ends.

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
          WHEN relevanceClassOverride IS NOT NULL THEN relevanceClassOverride -- Use explicit override if set
          WHEN startsAt <= '${nowFormatted}' AND (endDateTime IS NULL OR endDateTime >= '${nowFormatted}') THEN ${gEventRelevanceClass.Ongoing}
          WHEN startsAt >= '${nowFormatted}' AND startsAt <= '${sevenDaysFromNowFormatted}' THEN ${gEventRelevanceClass.Upcoming}
          WHEN endDateTime IS NOT NULL AND endDateTime >= '${twentyFourHoursAgoFormatted}' AND endDateTime <= '${nowFormatted}' THEN ${gEventRelevanceClass.RecentPast}
          WHEN startsAt > '${sevenDaysFromNowFormatted}' THEN ${gEventRelevanceClass.Future} -- Future, only shown if better events aren't available
          ELSE ${gEventRelevanceClass.Hidden} -- Default/Unclassified (optional, for events that don't fit the criteria)
        END AS relevance_class
      FROM Event
      where
        (
            (relevanceClassOverride is not null)
            or (statusId is null or statusId NOT IN (${cancelledStatusIds}))
        )
        and isDeleted = false
        and (${xEvent.SqlGetVisFilterExpression(currentUser, "Event")})
    )
    SELECT id, relevance_class
    FROM ClassifiedEvents
    WHERE relevance_class IN (${gVisibleEventRelevanceClasses.join(",")}) -- Filter to relevant events
    ORDER BY
      relevance_class ASC, -- Primary sorting by relevance
      startsAt ASC
    LIMIT ${5};
    
    `;

    // debugger;
    const events = (await db.$queryRaw(Prisma.raw(query))) as { id: number, relevance_class: bigint }[];

    // only show class 4 events if there are no class 1, 2, or 3 events.
    const hasClass123 = events.some(e => e.relevance_class < 4);
    if (hasClass123) {
        // filter out class 4 events
        return events.filter(e => e.relevance_class < 4).map(e => e.id);
    } else {
        // take only the 1st class 4 event if exists.
        const class4Event = events.find(e => BigintToNumber(e.relevance_class) === 4);
        if (class4Event) {
            return [class4Event.id];
        }
    }

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

            const relevantEventsCall = getTopRelevantEvents(currentUser, eventStatus, db as any /* Excessive stack depth comparing types 'PrismaClient<PrismaClientOptions, unknown, InternalArgs> & EnhancedPrismaClientAddedMethods' and 'TransactionalPrismaClient' */);

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
                db.wikiPageTag.findMany(),
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
                wikiPageTag,
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
                wikiPageTag,
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



