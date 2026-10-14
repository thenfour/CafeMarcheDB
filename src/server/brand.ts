import { DbBrandConfig, DefaultDbBrandConfig, HostingMode } from "shared/brandConfigBase";
import { validateDbBrandConfig } from "shared/brandingValidation";
import { BandSettingsRegistryKey, kBandSettingsRegistry } from "src/setting/shared/bandSettingsRegistry";
import { validateSettingValue } from "src/setting/shared/settingsContract";
import db from "db";

type CacheEntry = { value: DbBrandConfig; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10_000;
const normalizeHost = (host?: string | null): string => host?.toLowerCase() ?? "default";

// Only a trusted resolved ID can select a band's branding. Host/path resolution follows in phase 5.
export async function loadDbBrandConfig({ hostHeader, bandId: selectedBandId, freshness }: {
    readonly hostHeader?: string | null;
    readonly bandId: number | null;
    readonly freshness: "cached" | "refresh";
}): Promise<DbBrandConfig> {
    const cacheKey = `${selectedBandId ?? "platform"}/${normalizeHost(hostHeader)}`;
    const hit = cache.get(cacheKey);
    if (freshness === "cached" && hit && hit.expiresAt > Date.now()) {
        return hit.value;
    }
    try {
        // todo: probably cache settings; avoid ad-hoc one-row db fetches like this
        const rows = selectedBandId === null ? [] : await db.bandSetting.findMany({ where: { bandId: selectedBandId } });
        const byName = new Map(rows.map(row => [row.name, row.value]));

        // helper to read a setting value from 
        const read = (key: BandSettingsRegistryKey): string => byName.has(key)
            ? String(validateSettingValue("band", key, byName.get(key)!)) : kBandSettingsRegistry[key].defaultValue;

        const defaultTheme = DefaultDbBrandConfig.theme!;
        const value = validateDbBrandConfig({
            hostingMode: process.env.CMDB_HOSTING_MODE ?? HostingMode.Platform,
            siteTitle: read("siteCustomization.title"),
            siteTitlePrefix: read("siteCustomization.titlePrefix"),
            siteFaviconUrl: read("siteCustomization.faviconUrl"),
            siteLogoUrl: read("siteCustomization.logoUrl"),
            theme: {
                primaryMain: read("siteCustomization.themeColors.primaryMain") || defaultTheme.primaryMain,
                secondaryMain: read("siteCustomization.themeColors.secondaryMain") || defaultTheme.secondaryMain,
                backgroundDefault: read("siteCustomization.themeColors.backgroundDefault") || defaultTheme.backgroundDefault,
                backgroundPaper: read("siteCustomization.themeColors.backgroundPaper") || defaultTheme.backgroundPaper,
                textPrimary: read("siteCustomization.themeColors.textPrimary") || undefined,
                contrastText: read("siteCustomization.themeColors.contrastText") || defaultTheme.contrastText,
            },
        });
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
