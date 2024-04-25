import { resolver } from "@blitzjs/rpc"
import db from "db"
import { arraysContainSameValues } from "shared/utils"


// return whether the session changed or not.
export default resolver.pipe(
    async ({ }, ctx) => {
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
);



