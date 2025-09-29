// Centralized branding model
// - HostingMode comes from NEXT_PUBLIC_* env (build-time safe & public)
// - Title/Prefix/Favicon come from DB (SSR per request), provided via React context

import React from "react";

export enum HostingMode {
  CafeMarche = "CafeMarche",
  GenericSingleTenant = "GenericSingleTenant",
}

// Strictly parse env into our enum, supporting historical var names
export function getHostingMode(): HostingMode {
  const raw = (process.env.NEXT_PUBLIC_CMDB_HOSTING_MODE
    || process.env.NEXT_PUBLIC_DASHBOARD_HOSTING_MODE
    || "").trim();
  return raw === HostingMode.CafeMarche ? HostingMode.CafeMarche : HostingMode.GenericSingleTenant;
}

// Exposed constant for convenience where only hosting mode is needed
export const BrandConfig = {
  hostingMode: getHostingMode(),
} as const;

export type DbBrandConfig = {
  siteTitle: string;
  siteTitlePrefix: string;
  siteFaviconUrl: string;
};

export const DefaultDbBrandConfig: DbBrandConfig = {
  siteTitle: "defaultSiteTitle",
  siteTitlePrefix: "D: ",
  siteFaviconUrl: "/favicon.png",
};

export const BrandContext = React.createContext<DbBrandConfig>(DefaultDbBrandConfig);
export const useBrand = () => React.useContext(BrandContext);
