// Centralized, build/runtime brand configuration for dashboard/public branding.
// Client-safe values must begin with NEXT_PUBLIC_ so Next/Blitz inlines them at build time.

export enum HostingMode {
  CafeMarche = "CafeMarche",
  GenericSingleTenant = "GenericSingleTenant",
}

// Note: these are read on both server and client. Defaults preserve current behavior.
export const BrandConfig = {
  siteTitle: process.env.NEXT_PUBLIC_CMDB_SITE_TITLE,// ?? "Café Marché Backstage",
  siteTitlePrefix: process.env.NEXT_PUBLIC_CMDB_SITE_TITLE_PREFIX,// ?? "CM: ",
  siteFaviconUrl: process.env.NEXT_PUBLIC_CMDB_SITE_FAVICON_URL,// ?? "/favicon.png",
  hostingMode: (process.env.NEXT_PUBLIC_CMDB_HOSTING_MODE as HostingMode),// ?? HostingMode.GenericSingleTenant,
} as const;

export type BrandConfigType = typeof BrandConfig;
