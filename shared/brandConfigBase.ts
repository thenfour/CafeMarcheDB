

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
