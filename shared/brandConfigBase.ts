
export enum HostingMode {
    CafeMarche = "CafeMarche",
    GenericSingleTenant = "GenericSingleTenant",
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
    hostingMode: HostingMode;
};

export const DefaultDbBrandConfig: DbBrandConfig = {
    siteTitle: "Backstage",
    siteTitlePrefix: "BS: ",
    siteFaviconUrl: "/favicon.png",
    siteLogoUrl: undefined,
    hostingMode: HostingMode.GenericSingleTenant,
    theme: {
        primaryMain: "#344873", // matches themeOptions
        secondaryMain: "#831012",
        backgroundDefault: "#fafafa",
        backgroundPaper: "#ffffff",
        // textPrimary omitted to let MUI compute suitable contrast
        contrastText: "#ede331",
    },
};
