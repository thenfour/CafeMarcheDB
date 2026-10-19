import { gPermissionRegistry, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import type { AuthorizationTestUser } from "../authorization/support/authorizationFixtures";
import { createAuthorizationSeed } from "../authorization/support/authorizationSeed";

export const calendarBandPublicId = parsePublicId<"Band">("CalendarBand0001");

/** Calendar subscribers receive explicit account roles and event-reading band roles. */
export function calendarAuthorizationSeed(users: readonly AuthorizationTestUser[]) {
    const seed = createAuthorizationSeed(users.map(user => ({
        ...user, permissions: [...new Set([...user.permissions, Permission.view_events_nonpublic])],
    })), [], gPermissionRegistry.map((definition, index) => ({ id: index + 1, name: definition.key, isDeleted: false })));
    return {
        ...seed,
        band: [{ id: 1, publicId: calendarBandPublicId, isDeleted: false }],
        bandUser: seed.bandUser.map(member => ({ ...member, id: member.userId + 100 })),
        change: [],
    };
}
