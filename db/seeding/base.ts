import type { Prisma } from "@prisma/client";
import type { SeedingConfig } from "./config";
import type { SeedLocale } from "./localization";
import type { SeedPlatformCatalogs } from "./catalogs";
import type { SeedBand } from "./bands";
import { choose } from "./random";

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
