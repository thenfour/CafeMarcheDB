import { generateToken, hash256 } from "@blitzjs/auth";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { Stopwatch } from "shared/rootroot";
import { getServerStartState } from "shared/serverStateBase";
import { arraysContainSameValues } from "shared/utils";
import { xMenuLink, xTableClientUsageContext } from "src/core/db3/db3";
import { DB3QueryCore2 } from "src/core/db3/server/db3QueryCore";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";


async function RefreshSessionPermissions(ctx: AuthenticatedCtx) {
    const publicData = ctx.session?.$publicData;
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

            const results = await Promise.all([
                db.userTag.findMany(),
                db.permission.findMany(),
                db.role.findMany(),
                db.rolePermission.findMany(),
                db.eventType.findMany(),
                db.eventStatus.findMany(),
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
            ]);

            const rsp = await RefreshSessionPermissions(ctx);

            const [
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
                dynMenuLinks,
                eventCustomField,
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



