import { DbBrandConfig, PlatformDbBrandConfig } from "shared/brandConfigBase";
import { resolveBandBranding } from "./bandBranding";
import db from "db";

type CacheEntry = { value: DbBrandConfig; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10_000;
const normalizeHost = (host?: string | null): string => host?.toLowerCase() ?? "default";

// Only a trusted resolved ID can select a band's branding.
export async function loadDbBrandConfig({ hostHeader, bandId: selectedBandId, freshness, pageTheming }: {
    readonly hostHeader?: string | null;
    readonly bandId: number | null;
    readonly freshness: "cached" | "refresh";
    readonly pageTheming: "band" | "platform";
}): Promise<DbBrandConfig> {
    if (pageTheming === "platform") {
        return PlatformDbBrandConfig;
    }
    const cacheKey = `${selectedBandId ?? "platform"}/${normalizeHost(hostHeader)}`;
    const hit = cache.get(cacheKey);
    if (freshness === "cached" && hit && hit.expiresAt > Date.now()) {
        return hit.value;
    }
    try {
        // todo: probably cache settings; avoid ad-hoc one-row db fetches like this
        const rows = selectedBandId === null ? [] : await db.bandSetting.findMany({ where: { bandId: selectedBandId } });
        const value = resolveBandBranding(rows);
        cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
    } catch (error) {
        if (hit) {
            console.error(`[branding] Failed to refresh ${cacheKey}; serving the last known good value.`, error);
            return hit.value;
        }
        throw error;
    }
}

export function clearBrandCache(hostHeader?: string | null): void {
    cache.forEach((entry, key) => {
        if (!hostHeader || key.endsWith(`/${normalizeHost(hostHeader)}`)) entry.expiresAt = 0;
    });
}
