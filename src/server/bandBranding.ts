import type { BandSetting } from "@prisma/client";
import { DefaultDbBrandConfig } from "shared/brandConfigBase";
import { DbBrandConfigSchema } from "shared/brandingValidation";
import { kBandSettingsRegistry, type BandSettingsRegistryKey } from "src/setting/shared/bandSettingsRegistry";
import { validateSettingValue } from "src/setting/shared/settingsContract";

/** Resolve branding consistently for page themes and band identifiers. */
export function resolveBandBranding(rows: readonly Pick<BandSetting, "name" | "value">[]) {
    const byName = new Map(rows.map(row => [row.name, row.value]));
    const read = (key: BandSettingsRegistryKey): string => byName.has(key)
        ? String(validateSettingValue("band", key, byName.get(key)!)) : kBandSettingsRegistry[key].defaultValue;
    const defaultTheme = DefaultDbBrandConfig.theme!;

    return DbBrandConfigSchema.parse({
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
}
