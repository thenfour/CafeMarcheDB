import type { Prisma } from "@prisma/client";
import type { SeedingConfig } from "./config";
import type { SeedLocale } from "./localization";
import type { SeedPlatformCatalogs } from "./catalogs";
import type { SeedBand } from "./bands";
import { choose, randomDate } from "./random";

export interface SeedingState {
    db: Prisma.TransactionClient;
    config: Readonly<SeedingConfig>;
    now: Date;
    locales: ReadonlyMap<SeedLocale, number>;
    platform: SeedPlatformCatalogs;
    band: SeedBand;
    visibilityPermissionIds: readonly number[];
    assetDirectory: string;
}

export function randomVisibilityPermissionId(state: SeedingState): number | null {
    return choose([null, ...state.visibilityPermissionIds]);
}

/** Authored content follows its creator's membership and precedes its latest allowed date. */
export function seedContentAuthorship(state: SeedingState, latest: Date): { createdByUserId: number; createdAt: Date } {
    const creator = choose(state.band.members.filter(member => member.createdAt <= latest));
    const earliest = new Date(Math.max(creator.createdAt.valueOf(), latest.valueOf() - 365 * 86_400_000));
    return { createdByUserId: creator.userId, createdAt: randomDate(earliest, latest) };
}
