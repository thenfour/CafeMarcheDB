import { resolver } from "@blitzjs/rpc";
import db from "db";
import {
    siteBrandingSettingNames,
    siteBrandingSettingsFromValues,
} from "shared/siteBranding";

// Branding is public presentation data. Editing it is protected separately by
// updateSiteBrandingSettings.
export default resolver.pipe(
    async () => {
        const rows = await db.setting.findMany({
            where: { name: { in: [...siteBrandingSettingNames] } },
        });
        return siteBrandingSettingsFromValues(
            new Map(rows.map(row => [row.name, row.value])),
        );
    },
);
