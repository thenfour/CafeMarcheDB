import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import type { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { resolveAuthorizedDynamicStrings, type LocalizationDatabase } from "src/locale/server/localization";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";

export interface BandInstrumentOptInChoices {
    readonly globalInstruments: Array<{ publicId: string; name: string | null }>;
    readonly globalGroups: Array<{ publicId: string; name: string | null }>;
}

async function readOptInChoices(database: LocalizationDatabase & Pick<Prisma.TransactionClient,
    "bandInstrument" | "bandInstrumentFunctionalGroup" | "globalInstrument" | "globalInstrumentFunctionalGroup">,
    auth: CMServerAuthorization, preferences: LocalePreferenceInput,
): Promise<BandInstrumentOptInChoices> {
    if (!auth.hasPermission(BandPermission.admin_instruments)) {
        return { globalGroups: [], globalInstruments: [] };
    }
    const bandId = auth.requireBand().id;
    const [sourceGroups, sourceInstruments, ownedGroups, ownedInstruments] = await Promise.all([
        database.globalInstrumentFunctionalGroup.findMany({ select: { id: true, publicId: true, nameId: true } }),
        database.globalInstrument.findMany({ select: { id: true, publicId: true, nameId: true } }),
        database.bandInstrumentFunctionalGroup.findMany({ where: { bandId }, select: { globalFunctionalGroupId: true } }),
        database.bandInstrument.findMany({ where: { bandId }, select: { globalInstrumentId: true } }),
    ]);
    const strings = await resolveAuthorizedDynamicStrings(database, auth,
        [...new Set([...sourceGroups, ...sourceInstruments].map(row => row.nameId))], preferences);
    const choices = (sources: ReadonlyArray<{ id: number; publicId: string; nameId: number }>, owned: readonly (number | null)[]) =>
        sources.filter(row => !owned.includes(row.id)).map(row => ({ publicId: row.publicId, name: strings.get(row.nameId)?.value ?? null }));
    return { globalGroups: choices(sourceGroups, ownedGroups.map(row => row.globalFunctionalGroupId)),
        globalInstruments: choices(sourceInstruments, ownedInstruments.map(row => row.globalInstrumentId)) };
}

/** Ordinary catalog references come from the dashboard; this request supplies only global opt-in choices. */
export async function loadBandInstrumentOptInChoices(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    preferences: LocalePreferenceInput,
): Promise<BandInstrumentOptInChoices> {
    return executeDB3Read(database, authorization, async context => {
        context.authorization.requirePermission(Permission.login);
        context.authorization.requireBand();
        return readOptInChoices(context.database, context.authorization, preferences);
    });
}
