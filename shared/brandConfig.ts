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

export type ThemeBrand = {
  primaryMain?: string;
  secondaryMain?: string;
  backgroundDefault?: string;
  backgroundPaper?: string;
  textPrimary?: string;
  contrastText?: string;
};

export type DbBrandConfig = {
  siteTitle: string;
  siteTitlePrefix: string;
  siteFaviconUrl: string;
  siteLogoUrl?: string;
  theme?: ThemeBrand;
};

export const DefaultDbBrandConfig: DbBrandConfig = {
  siteTitle: "Café Marché Backstage",
  siteTitlePrefix: "CM: ",
  siteFaviconUrl: "/favicon.png",
  siteLogoUrl: undefined,
  theme: {
    primaryMain: "#344873", // matches themeOptions
    secondaryMain: "#831012",
    backgroundDefault: "#fafafa",
    backgroundPaper: "#ffffff",
    // textPrimary omitted to let MUI compute suitable contrast
    contrastText: "#ede331",
  },
};

export const BrandContext = React.createContext<DbBrandConfig>(DefaultDbBrandConfig);
export const useBrand = () => React.useContext(BrandContext);
