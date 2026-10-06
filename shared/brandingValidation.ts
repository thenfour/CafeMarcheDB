import parseCssColor from "parse-css-color";
import { z } from "zod";
import { HostingMode, type DbBrandConfig } from "./brandConfigBase";

function hasMuiSupportedColorSyntax(value: string): boolean {
    const trimmed = value.trim();
    if (!/^(#|rgba?\(|hsla?\()/i.test(trimmed)) return false;
    try { return parseCssColor(trimmed) !== null; } catch { return false; }
}

function isBrandAssetUrl(value: string): boolean {
    if (value === "") return true;
    if (value !== value.trim()) return false;
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch { return false; }
}

export const BrandAssetUrlSchema = z.string().max(500).refine(isBrandAssetUrl, {
    message: "Must be empty, a root-relative path, or an http(s) URL",
});
export const RequiredBrandColorSchema = z.string().max(150).refine(hasMuiSupportedColorSyntax, {
    message: "Must be a valid hex, rgb(a), or hsl(a) color",
});
export const OptionalBrandColorSchema = z.string().max(150).refine(
    value => value === "" || hasMuiSupportedColorSyntax(value),
    { message: "Must be empty or a valid hex, rgb(a), or hsl(a) color" },
);

export const DbBrandConfigSchema = z.object({
    siteTitle: z.string(), siteTitlePrefix: z.string(), siteFaviconUrl: BrandAssetUrlSchema,
    siteLogoUrl: BrandAssetUrlSchema.optional(), hostingMode: z.nativeEnum(HostingMode),
    theme: z.object({
        primaryMain: RequiredBrandColorSchema, secondaryMain: RequiredBrandColorSchema,
        backgroundDefault: RequiredBrandColorSchema, backgroundPaper: RequiredBrandColorSchema,
        textPrimary: OptionalBrandColorSchema.optional(), contrastText: RequiredBrandColorSchema,
    }).strict(),
}).strict();

export function validateDbBrandConfig(value: unknown): DbBrandConfig {
    return DbBrandConfigSchema.parse(value);
}
