import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import { resolveAuthorizedDynamicStrings } from "src/locale/server/localization";
import { collectLocalePreferences, selectFormattingLocale, type LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { loadAuthorizationForUser, type CMServerAuthorization } from "./serverAuthorization";
import type { AvailableBand } from "../shared/availableBands";
import { resolveBandBranding } from "src/server/bandBranding";
import { kBandSettingsRegistry } from "@/src/setting/shared/bandSettingsRegistry";

/** Memberships supply ordinary choices; global band administrators may choose any active band. */
export function loadAvailableBands(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    preferences: LocalePreferenceInput,
): Promise<AvailableBand[]> {

    // lsmb TODO: must be a db3 query. this ad-hoc soft-delete and auth is not acceptible.
    return executeDB3Read(database, authorization, async ({ database: transaction, authorization: fresh }) => {
        if (!fresh.user || !fresh.hasPermission(Permission.login)) {
            return [];
        }

        const mayChooseAnyBand = fresh.hasPermission(Permission.global_band_admin)
            || fresh.hasPermission(Permission.manage_bands);

        const brandingSettingNames = Object.entries(kBandSettingsRegistry)
            .filter(([_, setting]) => !!setting.isBranding)
            .map(([name, _]) => name);

        const bands = await transaction.band.findMany({
            where: {
                isDeleted: false,
                ...(mayChooseAnyBand ? {} : {
                    bandUsers: { some: { userId: fresh.user.id, isDeleted: false } },
                }),
            },
            select: {
                publicId: true,
                nameId: true,
                bandSettings: {
                    where: { name: { in: brandingSettingNames } },
                    select: { name: true, value: true },
                },
                locales: {
                    where: {
                        locale: {
                            isDeleted: false
                        }
                    },
                    select: {
                        locale: {
                            select: {
                                ietfTag: true
                            }
                        }
                    },
                }
            },
            orderBy: { publicId: "asc" },
        });

        const choices = await Promise.all(bands.map(async band => {
            const publicId = parsePublicId<"Band">(band.publicId);
            // Resolve each name in its own band, including its enabled locales and overrides.
            const targetAuthorization = await loadAuthorizationForUser(fresh.user, transaction, publicId);
            const names = await resolveAuthorizedDynamicStrings(transaction, targetAuthorization, [band.nameId], preferences);
            const brand = resolveBandBranding(band.bandSettings);
            return {
                publicId,
                name: names.get(band.nameId)?.value ?? null,
                logoUrl: brand.siteLogoUrl ?? "",
                theme: {
                    primaryMain: brand.theme.primaryMain,
                    secondaryMain: brand.theme.secondaryMain,
                    contrastText: brand.theme.contrastText,
                },
                supportedLocales: band.locales.map(assignment => assignment.locale.ietfTag),
            };
        }));

        const collator = new Intl.Collator(selectFormattingLocale(collectLocalePreferences(preferences)), { numeric: true });

        // sort choices by name, publicId
        return choices.sort((left, right) => collator.compare(left.name ?? "", right.name ?? "")
            || left.publicId.localeCompare(right.publicId));
    });
}
