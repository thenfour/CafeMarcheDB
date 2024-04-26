import { generateToken, hash256 } from "@blitzjs/auth";
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
);



