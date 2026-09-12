import { DbBrandConfig, DefaultDbBrandConfig } from "@/shared/brandConfigBase";
import { validateDbBrandConfig } from "@/shared/brandingValidation";
import { Setting } from "@/shared/settingKeys";
import db from "db";

type CacheEntry = { value: DbBrandConfig; expiresAt: number };
const CACHE_TTL_MS = 10_000; // 10s, fast follow for admin changes without heavy DB churn
const cache = new Map<string, CacheEntry>();

function normalizeHost(hostHeader?: string | null): string {
  if (!hostHeader) return "default";
  // strip port
  return hostHeader.split(":")[0]!.toLowerCase();
}

export async function loadDbBrandConfig(hostHeader?: string | null): Promise<DbBrandConfig> {
  const host = normalizeHost(hostHeader);
  const now = Date.now();
  const hit = cache.get(host);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    // For now, settings are global; the host key keeps this ready for a future
    // realm-specific store and prevents one host's stale value serving another.
    const names = [
      Setting.Dashboard_HostingMode,
      Setting.Dashboard_SiteTitle,
      Setting.Dashboard_SiteTitlePrefix,
      Setting.Dashboard_SiteFaviconUrl,
      Setting.Dashboard_SiteLogoUrl,
      Setting.Dashboard_Theme_PrimaryMain,
      Setting.Dashboard_Theme_SecondaryMain,
      Setting.Dashboard_Theme_BackgroundDefault,
      Setting.Dashboard_Theme_BackgroundPaper,
      Setting.Dashboard_Theme_TextPrimary,
      Setting.Dashboard_Theme_ContrastText,
    ];

    const rows = await db.setting.findMany({ where: { name: { in: names } } });
    const byName = new Map(rows.map(r => [r.name, r.value] as const));
    const defaultTheme = DefaultDbBrandConfig.theme!;

    const value = validateDbBrandConfig({
      hostingMode: byName.get(Setting.Dashboard_HostingMode) ?? DefaultDbBrandConfig.hostingMode,
      siteTitle: byName.get(Setting.Dashboard_SiteTitle) ?? DefaultDbBrandConfig.siteTitle,
      siteTitlePrefix: byName.get(Setting.Dashboard_SiteTitlePrefix) ?? DefaultDbBrandConfig.siteTitlePrefix,
      siteFaviconUrl: byName.get(Setting.Dashboard_SiteFaviconUrl) ?? DefaultDbBrandConfig.siteFaviconUrl,
      siteLogoUrl: byName.get(Setting.Dashboard_SiteLogoUrl) ?? DefaultDbBrandConfig.siteLogoUrl,
      theme: {
        primaryMain: byName.get(Setting.Dashboard_Theme_PrimaryMain) ?? defaultTheme.primaryMain,
        secondaryMain: byName.get(Setting.Dashboard_Theme_SecondaryMain) ?? defaultTheme.secondaryMain,
        backgroundDefault: byName.get(Setting.Dashboard_Theme_BackgroundDefault) ?? defaultTheme.backgroundDefault,
        backgroundPaper: byName.get(Setting.Dashboard_Theme_BackgroundPaper) ?? defaultTheme.backgroundPaper,
        textPrimary: byName.get(Setting.Dashboard_Theme_TextPrimary) ?? defaultTheme.textPrimary,
        contrastText: byName.get(Setting.Dashboard_Theme_ContrastText) ?? defaultTheme.contrastText,
      },
    });

    cache.set(host, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (error) {
    if (hit) {
      console.error(`[branding] Failed to refresh brand for host ${JSON.stringify(host)}; serving the last known good value.`, error);
      return hit.value;
    }

    console.error(`[branding] Failed to load an initial brand for host ${JSON.stringify(host)}.`, error);
    throw error;
  }
}

export function clearBrandCache(hostHeader?: string | null) {
  // Expire rather than discard: the next request refreshes immediately, while
  // retaining a known-good identity if that refresh encounters a transient
  // database or configuration failure.
  if (!hostHeader) {
    cache.forEach(entry => { entry.expiresAt = 0; });
    return;
  }
  const entry = cache.get(normalizeHost(hostHeader));
  if (entry) entry.expiresAt = 0;
}
