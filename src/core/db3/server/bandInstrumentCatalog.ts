import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { resolveAuthorizedDynamicStrings, type LocalizationDatabase } from "src/locale/server/localization";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import type { StringResolution } from "src/locale/shared/stringResolution";
import { bandInstrumentGroupView, bandInstrumentView, xBandInstrument, xBandInstrumentFunctionalGroup, type BandInstrumentDto, type BandInstrumentGroupDto } from "../shared/entities/instrument/bandInstrumentContracts";
import { getDB3LocalizedIdentities, resolveDB3LocalizedFields } from "./db3LocalizedFields";
import type { xTable } from "../shared/db3core";

export type InstrumentCatalogDatabase = LocalizationDatabase & Pick<Prisma.TransactionClient,
    "bandInstrument" | "bandInstrumentFunctionalGroup" | "globalInstrument" | "globalInstrumentFunctionalGroup">;
const groupSelection = Prisma.validator<Prisma.BandInstrumentFunctionalGroupDefaultArgs>()({
    include: { globalFunctionalGroup: true, name: { select: { publicId: true } }, description: { select: { publicId: true } } },
});
const instrumentSelection = Prisma.validator<Prisma.BandInstrumentDefaultArgs>()({
    include: { globalInstrument: true, name: { select: { publicId: true } }, description: { select: { publicId: true } } },
});
function fieldIds(table: xTable, row: object, inherited: object | null): number[] {
    return [...getDB3LocalizedIdentities(table, row, inherited).values()].filter((id): id is number => id !== null);
}
const missingResolution: StringResolution = { value: null, localeTag: null, scope: "band", source: "missing", reason: "missing", requestedTag: null };
function localizedValues(table: xTable, row: object, inherited: object | null, strings: ReadonlyMap<number, StringResolution>) {
    const fields = resolveDB3LocalizedFields(table, row, inherited, strings, missingResolution);
    const nameResolution = fields.get("name") ?? missingResolution;
    const descriptionResolution = fields.get("description") ?? missingResolution;
    return { name: nameResolution.value, description: descriptionResolution.value, nameResolution, descriptionResolution };
}

export interface BandInstrumentCatalog {
    readonly instruments: BandInstrumentDto[];
    readonly groups: BandInstrumentGroupDto[];
    readonly globalInstruments: Array<{ publicId: string; name: string | null }>;
    readonly globalGroups: Array<{ publicId: string; name: string | null }>;
}

/** Read ownership first; batch-resolve only identities reached through those authorized rows. */
export async function loadBandInstrumentCatalog(database: InstrumentCatalogDatabase, auth: CMServerAuthorization,
    preferences: LocalePreferenceInput = {}, includeHidden = false,
): Promise<BandInstrumentCatalog> {
    auth.requirePermission(Permission.login);
    const bandId = auth.requireBand().id;
    const canManage = auth.hasPermission(Permission.admin_instruments);
    if (includeHidden && !canManage) throw new AuthorizationError("Hidden catalog entries require instrument administration.");
    const [groups, instruments, globalGroups, globalInstruments] = await Promise.all([
        database.bandInstrumentFunctionalGroup.findMany({ where: { bandId }, ...groupSelection }),
        database.bandInstrument.findMany({ where: { bandId }, ...instrumentSelection }),
        canManage ? database.globalInstrumentFunctionalGroup.findMany() : Promise.resolve<Array<Prisma.GlobalInstrumentFunctionalGroupGetPayload<{}>>>([]),
        canManage ? database.globalInstrument.findMany() : Promise.resolve<Array<Prisma.GlobalInstrumentGetPayload<{}>>>([]),
    ]);
    // Defense against an incorrectly scoped database adapter; no identities resolve before this check.
    for (const row of [...groups, ...instruments]) auth.requireBandResource(row.bandId);
    const identities = new Set([
        ...groups.flatMap(row => fieldIds(xBandInstrumentFunctionalGroup, row, row.globalFunctionalGroup)),
        ...instruments.flatMap(row => fieldIds(xBandInstrument, row, row.globalInstrument)),
        ...globalGroups.flatMap(row => fieldIds(xBandInstrumentFunctionalGroup, row, null)),
        ...globalInstruments.flatMap(row => fieldIds(xBandInstrument, row, null)),
    ]);
    const strings = await resolveAuthorizedDynamicStrings(database, auth, [...identities], preferences);
    const visibleGroups = groups.filter(row => includeHidden || !row.isHidden);
    const groupIds = new Map(visibleGroups.map(row => [row.id, row.publicId]));
    return {
        groups: visibleGroups.map(row => bandInstrumentGroupView.parseDto({
            ...localizedValues(xBandInstrumentFunctionalGroup,
                row,
                row.globalFunctionalGroup,
                strings),
            publicId: row.publicId,
            nameStringPublicId: row.name?.publicId ?? null,
            descriptionStringPublicId: row.description?.publicId ?? null,
            globalPublicId: row.globalFunctionalGroup?.publicId ?? null,
            isHidden: row.isHidden,
            sortOrder: row.sortOrder ?? row.globalFunctionalGroup?.sortOrder ?? 0,
            sortOrderOverride: row.sortOrder,
            colorOverride: row.color,
            color: row.color ?? row.globalFunctionalGroup?.color ?? null,
        })),
        instruments: instruments
            .filter(row => (includeHidden || !row.isHidden) && groupIds.has(row.functionalGroupId))
            .map(row => bandInstrumentView.parseDto({
                ...localizedValues(xBandInstrument,
                    row,
                    row.globalInstrument,
                    strings),
                publicId: row.publicId,
                nameStringPublicId: row.name?.publicId ?? null,
                descriptionStringPublicId: row.description?.publicId ?? null,
                globalPublicId: row.globalInstrument?.publicId ?? null,
                isHidden: row.isHidden,
                sortOrder: row.sortOrder ?? row.globalInstrument?.sortOrder ?? 0,
                functionalGroupId: groupIds.get(row.functionalGroupId),
                sortOrderOverride: row.sortOrder,
                autoAssignFileLeafRegexOverride: row.autoAssignFileLeafRegex,
                autoAssignFileLeafRegex: row.autoAssignFileLeafRegex ?? row.globalInstrument?.autoAssignFileLeafRegex ?? null,
            })),
        globalGroups: globalGroups
            .filter(row => !groups.some(group => group.globalFunctionalGroupId === row.id))
            .map(row => ({
                publicId: row.publicId,
                name: localizedValues(xBandInstrumentFunctionalGroup,
                    row,
                    null,
                    strings).name
            })),
        globalInstruments: globalInstruments
            .filter(row => !instruments.some(instrument => instrument.globalInstrumentId === row.id))
            .map(row => ({
                publicId: row.publicId,
                name: localizedValues(xBandInstrument, row, null, strings).name
            })),
    };
}
