import db from "db";
import { Setting } from "../../shared/settingKeys";
import { TransactionalPrismaClient } from "../core/db3/shared/apiTypes";
import { resolveBandTimeZone } from "@/shared/dateTimePolicy";

// Scheduling configuration is read fresh; it must not inherit the branding
// cache's last-known-good fallback when deciding event boundaries.
export async function loadBandTimeZone(client: TransactionalPrismaClient = db): Promise<string> {
    const setting = await client.setting.findFirst({ where: { name: Setting.BandTimeZone } });
    return resolveBandTimeZone(setting?.value);
}
