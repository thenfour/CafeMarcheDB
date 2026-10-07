import { Permission } from "shared/permissions";
import { parsePublicId, type BandPublicId } from "shared/publicId";
import { executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import { resolveAuthorizedDynamicStrings } from "src/locale/server/localization";
import { collectLocalePreferences, selectFormattingLocale, type LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { loadAuthorizationForUser, type CMServerAuthorization } from "./serverAuthorization";

export interface AvailableBand {
    readonly publicId: BandPublicId;
    readonly name: string | null;
}

/** The account may explicitly choose an active membership; platform Sysadmins may choose any active band. */
export function loadAvailableBands(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    preferences: LocalePreferenceInput,
): Promise<AvailableBand[]> {
    return executeDB3Read(database, authorization, async ({ database: transaction, authorization: fresh }) => {
        if (!fresh.user || !fresh.hasPermission(Permission.login)) {
            return [];
        }
        const bands = await transaction.band.findMany({
            where: {
                isDeleted: false,
                ...(fresh.hasPermission(Permission.sysadmin) ? {} : {
                    bandUsers: { some: { userId: fresh.user.id, isDeleted: false } },
                }),
            },
            select: { publicId: true, nameId: true },
            orderBy: { publicId: "asc" },
        });
        const choices = await Promise.all(bands.map(async band => {
            const publicId = parsePublicId<"Band">(band.publicId);
            // Resolve each name in its own band, including its enabled locales and overrides.
            const targetAuthorization = await loadAuthorizationForUser(fresh.user, transaction, publicId);
            const names = await resolveAuthorizedDynamicStrings(transaction, targetAuthorization, [band.nameId], preferences);
            return { publicId, name: names.get(band.nameId)?.value ?? null };
        }));
        const collator = new Intl.Collator(selectFormattingLocale(collectLocalePreferences(preferences)), { numeric: true });
        return choices.sort((left, right) => collator.compare(left.name ?? "", right.name ?? "")
            || left.publicId.localeCompare(right.publicId));
    });
}
