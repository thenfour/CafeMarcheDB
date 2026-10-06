import type { Prisma } from "@prisma/client";
import db from "db";
import { resolveBandTimeZone } from "shared/dateTimePolicy";
import { resolveAuthorizationContext, configuredBandScope } from "src/auth/server/authorizationContext";
import { decodeSettingStorage } from "src/setting/shared/settingsContract";
import { kBandSettingsRegistry } from "../setting/shared/bandSettingsRegistry";

type BandTimeZoneDatabase = Pick<Prisma.TransactionClient, "bandSetting" | "band">;
// Blitz's enhanced delegates exceed TS's comparison depth; this service uses standard Prisma methods.
const bandTimeZoneDatabase = db as unknown as BandTimeZoneDatabase;

// Scheduling reads stay fresh and callers pass their trusted active band's ID.
export async function loadBandTimeZone(client: BandTimeZoneDatabase = bandTimeZoneDatabase, bandId?: number): Promise<string> {
    const selectedBandId = bandId ?? (await resolveAuthorizationContext(client, configuredBandScope)).band?.id;
    if (selectedBandId === undefined) return resolveBandTimeZone(undefined);
    const row = await client.bandSetting.findUnique({
        where: {
            bandId_name:
            {
                bandId: selectedBandId,
                name: "dateTime.bandTimeZone" satisfies keyof typeof kBandSettingsRegistry
            }
        }
    });
    return resolveBandTimeZone(row ? String(decodeSettingStorage("band", row.name, row.value)) : undefined);
}
