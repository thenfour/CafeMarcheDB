import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { resolveAuthorizedDynamicStrings } from "src/locale/server/localization";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { bandInstrumentGroupView, bandInstrumentView, type BandInstrumentDto, type BandInstrumentGroupDto } from "../shared/entities/instrument/bandInstrumentContracts";
import { queryView } from "./db3QueryCore";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";

export type InstrumentCatalogDatabase = DB3ReadDatabase;
export interface BandInstrumentCatalog {
    readonly instruments: BandInstrumentDto[];
    readonly groups: BandInstrumentGroupDto[];
    readonly globalInstruments: Array<{ publicId: string; name: string | null }>;
    readonly globalGroups: Array<{ publicId: string; name: string | null }>;
}

/** This workflow bundles opt-in choices and group references; ordinary entity reads use queryView. */
export async function loadBandInstrumentCatalog(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    preferences: LocalePreferenceInput = {}, includeHidden = false,
): Promise<BandInstrumentCatalog> {
    return executeDB3Read(database, authorization, async context => {
        const { database: transaction, authorization: auth } = context;
        auth.requirePermission(Permission.login);
        auth.requireBand();
        if (includeHidden) auth.requirePermission(Permission.admin_instruments);
        const filter = { tableParams: includeHidden ? { includeHidden: true } : {} };
        const [groups, instruments] = await Promise.all([
            queryView({ view: bandInstrumentGroupView, filter, cmdbQueryContext: "instrument group choices", ...preferences }, auth, context),
            queryView({ view: bandInstrumentView, filter, cmdbQueryContext: "instrument catalog", ...preferences }, auth, context),
        ]);
        const [sourceGroups, sourceInstruments] = auth.hasPermission(Permission.admin_instruments) ? await Promise.all([
            transaction.globalInstrumentFunctionalGroup.findMany(), transaction.globalInstrument.findMany(),
        ]) : [[], []];
        // Global opt-in is a domain operation; resolve its choices with the same localization service.
        const strings = await resolveAuthorizedDynamicStrings(transaction, auth,
            [...new Set([...sourceGroups, ...sourceInstruments].map(row => row.nameId))], preferences);
        const choices = (sources: ReadonlyArray<{ publicId: string; nameId: number }>, owned: readonly (string | null)[]) =>
            sources.filter(row => !owned.includes(row.publicId)).map(row => ({ publicId: row.publicId, name: strings.get(row.nameId)?.value ?? null }));
        return { groups: groups.items, instruments: instruments.items,
            globalGroups: choices(sourceGroups, groups.items.map(row => row.globalPublicId)),
            globalInstruments: choices(sourceInstruments, instruments.items.map(row => row.globalPublicId)) };
    });
}
