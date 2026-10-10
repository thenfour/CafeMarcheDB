import type { DB3ReadContext } from "./db3ReadExecution";

// lsmb todo: the concept of "has limited access" should probably be expressed through a PERMISSION
// not an attribute on a role. for example, Permission.show_limited_access_banner and don't place it on
// member/elevated roles.
export async function hasLimitedDashboardAccess({ authorization: auth, database }: DB3ReadContext): Promise<boolean> {
    if (!auth.user) {
        return false;
    }
    if (!auth.band) {
        // "limited access" is only a band concept.
        return false;
    }
    if (!auth.membership || auth.membership.bandRoleId === null) {
        // no membership = limited access
        return true;
    }

    // this is the "real" check -- see if your role has the isRoleForNewUsers flag.
    // lsmb todo: bring this into a semantic call rather than ad-hoc query here.
    const role = await database.bandRole.findUniqueOrThrow({
        where: { id: auth.membership.bandRoleId },
        select: {
            isDeleted: true,
            isRoleForNewUsers: true,
        }
    });
    return role.isDeleted || role.isRoleForNewUsers;
}
