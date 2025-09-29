import type { DbBrandConfig } from "@/shared/brandConfig";
import { Setting } from "@/shared/settings";
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

  // For now, global settings; future: scope by host realm if schema supports it
  const names = [
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

  const siteTitle = byName.get(Setting.Dashboard_SiteTitle) ?? "";
  const siteTitlePrefix = byName.get(Setting.Dashboard_SiteTitlePrefix) ?? "";
  const siteFaviconUrl = byName.get(Setting.Dashboard_SiteFaviconUrl) ?? "";
  const siteLogoUrl = byName.get(Setting.Dashboard_SiteLogoUrl) ?? "";

  const theme = {
    primaryMain: byName.get(Setting.Dashboard_Theme_PrimaryMain) ?? "",
    secondaryMain: byName.get(Setting.Dashboard_Theme_SecondaryMain) ?? "",
    backgroundDefault: byName.get(Setting.Dashboard_Theme_BackgroundDefault) ?? "",
    backgroundPaper: byName.get(Setting.Dashboard_Theme_BackgroundPaper) ?? "",
    textPrimary: byName.get(Setting.Dashboard_Theme_TextPrimary) ?? "",
    contrastText: byName.get(Setting.Dashboard_Theme_ContrastText) ?? "",
  } as DbBrandConfig["theme"];

  const value: DbBrandConfig = { siteTitle, siteTitlePrefix, siteFaviconUrl, siteLogoUrl, theme };
  cache.set(host, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export function clearBrandCache(hostHeader?: string | null) {
  if (!hostHeader) { cache.clear(); return; }
  cache.delete(normalizeHost(hostHeader));
}
