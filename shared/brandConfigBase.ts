

export type HostingMode = "Platform" | "CafeMarche" | "GenericSingleTenant";

// for performance don't use zod
export function normalizeHostingMode(mode: string | undefined): HostingMode {
    if (mode === "Platform" || mode === "CafeMarche" || mode === "GenericSingleTenant") {
        return mode;
    }
    throw new Error(`Invalid hosting mode: ${mode}`);
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

// Missing band settings use these defaults; platform branding has its own identity.
export const DefaultDbBrandConfig: DbBrandConfig = {
    siteTitle: "Backstage",
    siteTitlePrefix: "BS: ",
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

export const PlatformDbBrandConfig: DbBrandConfig = {
    siteTitle: "CMDB",
    siteTitlePrefix: "CMDB: ",
    siteFaviconUrl: "/favicon.png",
    siteLogoUrl: undefined,
    theme: {
        primaryMain: "#26364a",
        secondaryMain: "#536878",
        backgroundDefault: "#f4f6f8",
        backgroundPaper: "#ffffff",
        textPrimary: "#17212f",
        contrastText: "#ffffff",
    },
};
