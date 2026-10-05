import { Prisma } from "@prisma/client";
import { AuthorizationError, NotFoundError } from "blitz";
import db from "db";
import { parsePublicId, type BandPublicId } from "shared/publicId";

// Standard Prisma delegates work both inside and outside transactions. Keep
// this boundary independent of DB3's older, untyped transaction alias.
export type AuthorizationDatabase = Pick<Prisma.TransactionClient,
    "user" | "band" | "bandUser" | "locale" | "globalRole" | "bandRole" | "permission">;

// Blitz enhances the same Prisma delegates with incompatible generic types.
// This boundary uses only the standard Prisma query API at runtime.
export const authorizationDatabase = db as unknown as AuthorizationDatabase;

export type AuthorizationScopeSelection =
    | { readonly kind: "platform"; readonly locale?: string }
    | { readonly kind: "band"; readonly bandPublicId: BandPublicId; readonly locale?: string }
    | { readonly kind: "configured-band"; readonly locale?: string };

export const configuredBandScope = { kind: "configured-band" } as const;
export const platformScope = { kind: "platform" } as const;

const bandSelection = Prisma.validator<Prisma.BandSelect>()({
    id: true,
    publicId: true,
    locales: {
        where: { locale: { isDeleted: false } },
        orderBy: [{ sortOrder: "asc" }, { localeId: "asc" }],
        select: { locale: { select: { id: true, publicId: true, ietfTag: true } } },
    },
});

export const membershipSelection = Prisma.validator<Prisma.BandUserSelect>()({
    id: true, publicId: true, bandId: true, userId: true, bandRoleId: true, isDeleted: true,
});

export type AuthorizationBand = Prisma.BandGetPayload<{ select: typeof bandSelection }>;
export type AuthorizationMembership = Prisma.BandUserGetPayload<{ select: typeof membershipSelection }>;
export type AuthorizationLocale = AuthorizationBand["locales"][number]["locale"];

export interface ResolvedAuthorizationContext {
    readonly band: AuthorizationBand | null;
    readonly locale: AuthorizationLocale;
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
    const band = selection.kind === "platform" ? "platform"
        : selection.kind === "configured-band" ? `configured:${configuredBandId()}`
            : `band:${parsePublicId<"Band">(selection.bandPublicId)}`;
    return `${band}:${selection.locale ?? "en-US"}`;
}

function selectLocale(locales: readonly AuthorizationLocale[], requested?: string): AuthorizationLocale {
    const normalized = requested ? Intl.getCanonicalLocales(requested)[0] : "en-US";
    const exact = locales.find(locale => locale.ietfTag.toLowerCase() === normalized?.toLowerCase());
    const language = normalized?.split("-")[0]?.toLowerCase();
    const sameLanguage = locales.find(locale => locale.ietfTag.split("-")[0]?.toLowerCase() === language);
    const selected = exact ?? sameLanguage ?? locales.find(locale => locale.ietfTag === "en-US") ?? locales[0];
    if (!selected) throw new AuthorizationError("No active locale is available for this scope.");
    return selected;
}

export async function resolveAuthorizationContext(
    database: AuthorizationDatabase,
    selection: AuthorizationScopeSelection,
): Promise<ResolvedAuthorizationContext> {
    if (selection.kind === "platform") {
        const locales = await database.locale.findMany({
            where: { isDeleted: false },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { id: true, publicId: true, ietfTag: true },
        });
        return { band: null, locale: selectLocale(locales, selection.locale) };
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
            return resolveAuthorizationContext(database, { kind: "platform", locale: selection.locale });
        }
        throw new NotFoundError("The selected band is unavailable.");
    }
    return { band, locale: selectLocale(band.locales.map(entry => entry.locale), selection.locale) };
}
