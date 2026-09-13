import db from "db";
import { resolveBandTimeZone } from "shared/dateTimePolicy";
import { Setting } from "shared/settingKeys";

// Scheduling configuration is read fresh; it must not inherit the branding
// cache's last-known-good fallback when deciding event boundaries.
export async function loadBandTimeZone(): Promise<string> {
    const setting = await db.setting.findFirst({ where: { name: Setting.BandTimeZone } });
    return resolveBandTimeZone(setting?.value);
}
