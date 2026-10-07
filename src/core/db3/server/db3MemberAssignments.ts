import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { BandUserPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { xTable } from "../shared/db3core";
import { xBandUser, activeBandMembershipWhere } from "../shared/entities/user/bandUser";
import { resolvePublicIds } from "./db3PublicIds";

export async function requireActiveBandMembership(
    database: Prisma.TransactionClient,
    auth: CMServerAuthorization,
    publicId: BandUserPublicId,
) {
    auth.requirePermission(Permission.login);
    const membership = await database.bandUser.findFirst({
        where: {
            ...activeBandMembershipWhere(),
            publicId,
            bandId: auth.requireBand().id,
        }
    });
    if (!membership) {
        throw new AuthorizationError("The membership cannot be edited.");
    }
    return membership;
}

export async function requireEditableBandMembership(
    database: Prisma.TransactionClient,
    auth: CMServerAuthorization,
    publicId: BandUserPublicId,
) {
    const membership = await requireActiveBandMembership(database, auth, publicId);
    if (!xBandUser.authorizeRowForEdit({ model: membership, auth })) {
        throw new AuthorizationError("The membership cannot be edited.");
    }
    return membership;
}

interface AssignedCatalogTarget {
    readonly publicId: string;
    readonly id: number;
    readonly bandId: number;
}

/** Keep hidden existing references; additions must resolve through the visible same-band catalog. */
export async function resolveMemberAssignmentTargets(database: Prisma.TransactionClient, auth: CMServerAuthorization,
    // The shared resolver supports different catalog models through their DB3 metadata.
    target: xTable, desiredPublicIds: readonly string[], existing: readonly AssignedCatalogTarget[],
): Promise<number[]> {
    for (const row of existing) {
        auth.requireBandResource(row.bandId);
    }
    const retained = new Map(existing.map(row => [row.publicId, row.id]));
    const additions = desiredPublicIds.filter(publicId => !retained.has(publicId));
    const addedIds = await resolvePublicIds(target, additions, auth, database);
    const identities = new Map(additions.map((publicId, index) => [publicId, addedIds[index]!]));
    return desiredPublicIds.map(publicId => retained.get(publicId) ?? identities.get(publicId)!);
}
