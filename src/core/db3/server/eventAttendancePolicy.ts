import { BandPermission, kGlobalVisibilityPermissionPolicy } from "src/auth/shared/bandPermissionPolicy";
import type { Prisma } from "@prisma/client";
import { AuthorizationError, NotFoundError } from "blitz";
import type { BandPublicId, EventPublicId, UserPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { GetUserVisibilityWhereExpression } from "./db3Helpers";

export function requireAttendanceBand(auth: CMServerAuthorization, bandPublicId: BandPublicId): number {
    auth.requireUser();
    const band = auth.requireBand();
    if (band.publicId !== bandPublicId) {
        throw new AuthorizationError("Attendance requires the selected band.");
    }
    return band.id;
}

export function visibleAttendanceEvents(auth: CMServerAuthorization): Prisma.EventWhereInput {
    return {
        bandId: auth.requireBand().id,
        isDeleted: false,
        ...GetUserVisibilityWhereExpression({ auth, createdByUserIDColumnName: "createdByUserId",
            allowConfiguredVisibility: auth.hasPermission(kGlobalVisibilityPermissionPolicy) }),
    };
}

// The transport names a person; responses belong to that person's active membership in this band.
export async function findAttendanceMember(database: Prisma.TransactionClient, bandId: number, userId: UserPublicId) {
    return database.bandUser.findFirst({
        where: { bandId, isDeleted: false, user: { publicId: userId, isDeleted: false, mergedIntoUserId: null } },
        select: { id: true, userId: true },
    });
}

export async function requireAttendanceTarget(database: Prisma.TransactionClient, auth: CMServerAuthorization,
    args: { bandPublicId: BandPublicId; userId: UserPublicId; eventId: EventPublicId },
) {
    const bandId = requireAttendanceBand(auth, args.bandPublicId);
    const [member, event] = await Promise.all([
        findAttendanceMember(database, bandId, args.userId),
        database.event.findFirst({ where: { AND: [visibleAttendanceEvents(auth), { publicId: args.eventId }] }, select: { id: true } }),
    ]);
    if (!member || !event) {
        throw new NotFoundError();
    }
    return { member, event, bandId };
}

export function requireAttendanceRead(auth: CMServerAuthorization, bandPublicId: BandPublicId): number {
    const bandId = requireAttendanceBand(auth, bandPublicId);
    auth.requirePermission(BandPermission.view_events_nonpublic);
    return bandId;
}
