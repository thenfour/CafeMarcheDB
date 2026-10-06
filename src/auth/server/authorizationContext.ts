import { Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import db from "db";
import { parsePublicId, type BandPublicId } from "shared/publicId";

// Standard Prisma delegates work both inside and outside transactions. Keep
// this boundary independent of DB3's older, untyped transaction alias.
export type AuthorizationDatabase = Pick<Prisma.TransactionClient,
    "user" | "band" | "bandUser" | "globalRole" | "bandRole" | "permission">;

// Blitz enhances the same Prisma delegates with incompatible generic types.
// This boundary uses only the standard Prisma query API at runtime.
export const authorizationDatabase = db as unknown as AuthorizationDatabase;

const bandSelection = Prisma.validator<Prisma.BandSelect>()({
    id: true,
    publicId: true,
});

export const membershipSelection = Prisma.validator<Prisma.BandUserSelect>()({
    id: true, publicId: true, bandId: true, userId: true, bandRoleId: true, isDeleted: true,
});

export type AuthorizationBand = Prisma.BandGetPayload<{ select: typeof bandSelection }>;
export type AuthorizationMembership = Prisma.BandUserGetPayload<{ select: typeof membershipSelection }>;

export interface ResolvedAuthorizationContext {
    readonly band: AuthorizationBand | null;
}

export async function resolveAuthorizationContext(
    database: Pick<AuthorizationDatabase, "band">,
    bandPublicId?: BandPublicId | null,
): Promise<ResolvedAuthorizationContext> {
    if (bandPublicId == null) {
        return { band: null };
    }

    const band = await database.band.findFirst({
        where: {
            isDeleted: false,
            publicId: parsePublicId<"Band">(bandPublicId),
        },
        select: bandSelection,
    });
    if (!band) {
        throw new NotFoundError("The selected band is unavailable.");
    }
    return { band };
}
