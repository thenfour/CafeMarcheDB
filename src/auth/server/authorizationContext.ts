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

export type AuthorizationScopeSelection =
    | { readonly kind: "platform" }
    | { readonly kind: "band"; readonly bandPublicId: BandPublicId }
    | { readonly kind: "configured-band" };

export const configuredBandScope = { kind: "configured-band" } as const;
export const platformScope = { kind: "platform" } as const;

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

export function configuredBandId(): number {
    // The existing-data migration creates Café Marché as band 1. This server
    // configuration is an initial adapter; portal routing replaces its selection.
    const configured = process.env.CMDB_DEFAULT_BAND_ID ?? "1";
    if (!/^[1-9]\d*$/.test(configured) || !Number.isSafeInteger(Number(configured))) {
        throw new Error("CMDB_DEFAULT_BAND_ID must be a positive integer.");
    }
    return Number(configured);
}

export function authorizationScopeKey(selection: AuthorizationScopeSelection): string {
    return selection.kind === "platform" ? "platform"
        : selection.kind === "configured-band" ? `configured:${configuredBandId()}`
            : `band:${parsePublicId<"Band">(selection.bandPublicId)}`;
}

export async function resolveAuthorizationContext(
    database: Pick<AuthorizationDatabase, "band">,
    selection: AuthorizationScopeSelection,
): Promise<ResolvedAuthorizationContext> {
    if (selection.kind === "platform") {
        return { band: null };
    }

    const band = await database.band.findFirst({
        where: {
            isDeleted: false,
            ...(selection.kind === "band"
                ? { publicId: parsePublicId<"Band">(selection.bandPublicId) }
                : { id: configuredBandId() }),
        },
        select: bandSelection,
    });
    if (!band) {
        // A fresh platform install can bootstrap an account before its first
        // band exists. Explicit selections and deleted bands still fail closed.
        if (selection.kind === "configured-band" && process.env.CMDB_DEFAULT_BAND_ID === undefined
            && await database.band.count() === 0) {
            return { band: null };
        }
        throw new NotFoundError("The selected band is unavailable.");
    }
    return { band };
}
