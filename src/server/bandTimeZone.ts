import type { Prisma } from "@prisma/client";
import { resolveBandTimeZone } from "shared/dateTimePolicy";
import { validateSettingValue } from "src/setting/shared/settingsContract";
import { kBandSettingsRegistry } from "../setting/shared/bandSettingsRegistry";

type BandTimeZoneDatabase = Pick<Prisma.TransactionClient, "bandSetting">;
// Scheduling reads stay fresh and callers pass their trusted active band's ID.
export async function loadBandTimeZone(client: BandTimeZoneDatabase, bandId: number): Promise<string> {
    const row = await client.bandSetting.findUnique({
        where: {
            bandId_name:
            {
                bandId,
                name: "dateTime.bandTimeZone" satisfies keyof typeof kBandSettingsRegistry
            }
        }
    });
    return resolveBandTimeZone(row ? String(validateSettingValue("band", row.name, row.value)) : undefined);
}
