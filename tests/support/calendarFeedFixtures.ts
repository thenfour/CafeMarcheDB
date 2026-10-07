import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

export const calendarBandPublicId = parsePublicId<"Band">("CalendarBand0001");

/** Target-schema authority for calendar tests; legacy person roles confer no band grants. */
export function calendarAuthorizationSeed(users: readonly { id: number }[]) {
    const permissions = [Permission.login, Permission.view_events_nonpublic];
    return {
        user: users.map(user => ({ ...user, mergedIntoUserId: null, globalRoleId: null })),
        band: [{ id: 1, publicId: calendarBandPublicId, isDeleted: false }],
        bandUser: users.map(user => ({ id: user.id + 100, publicId: `Member${String(user.id).padStart(10, "0")}`,
            bandId: 1, userId: user.id, bandRoleId: 1, isDeleted: false })),
        permission: permissions.map((name, index) => ({ id: index + 1, name, isDeleted: false })),
        bandRole: [{ id: 1, isDeleted: false, isPublicRole: false, isRoleForNewUsers: false,
            bandRolePermissions: [{ id: 1, permission: { id: 2, name: Permission.view_events_nonpublic, isDeleted: false } }] }],
        globalRole: [{ id: 1, isDeleted: false, isSysAdminRole: true, permissions: [] }],
        change: [],
    };
}
