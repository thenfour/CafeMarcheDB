import type { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readActivityFacets } from "src/core/components/featureReports/server/facetProcessor";
import { emptyActivityFacetFilters } from "src/core/components/featureReports/ClientFacetHandlers";
import type { FacetedBreakdownInput } from "src/core/components/featureReports/activityReportTypes";
import type { SettingsMysqlFixture } from "./settingsMysqlFixture";

export async function prepareActivityReport(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const band = fixture.bands[0]!;
    const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.view_feature_reports, Permission.view_songs,
        Permission.view_events_nonpublic, Permission.view_wiki_pages, Permission.view_custom_links] } } });
    const role = await tx.bandRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId(),
        values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Activity reader" } } } },
        bandRolePermissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) } } });
    const member = await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
    const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
    const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const input: FacetedBreakdownInput = { bandPublicId: parsePublicId<"Band">(band.publicId), routeLocale: "fr-BE",
        startDate: new Date("2026-01-01T00:00:00Z"), endDateExclusive: new Date("2027-01-01T00:00:00Z"), selectedBucket: "all",
        filterSpec: { bucketSize: ActivityReportTimeBucketSize.all, excludeYourself: false, excludeSysadmins: false,
            includeFeatures: [], excludeFeatures: [], contextBeginsWith: null }, facetFilters: emptyActivityFacetFilters() };
    const add = (data: Partial<Prisma.ActionUncheckedCreateInput> = {}) => tx.action.create({ data: {
        bandId: band.id, isClient: true, feature: "facet-fixture", context: "fixture/report", createdAt: new Date("2026-04-01T00:00:00Z"), ...data,
    } });
    const read = (args = input) => readActivityFacets(snapshot, auth, args);
    const publicPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.public } });
    const hiddenPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.never_grant } });
    const song = (name: string, overrides: Partial<Prisma.SongUncheckedCreateInput> = {}) => tx.song.create({ data: {
        publicId: generatePublicId(), bandId: band.id, name, description: "", visiblePermissionId: publicPermission.id, ...overrides,
    } });
    const event = (name: string, overrides: Partial<Prisma.EventUncheckedCreateInput> = {}) => tx.event.create({ data: {
        publicId: generatePublicId(), bandId: band.id, name, revision: 1, visiblePermissionId: publicPermission.id, ...overrides,
    } });
    const wiki = (slug: string, overrides: Partial<Prisma.WikiPageUncheckedCreateInput> = {}) => tx.wikiPage.create({ data: {
        publicId: generatePublicId(), bandId: band.id, slug, visiblePermissionId: publicPermission.id, ...overrides,
    } });
    const menu = async (caption: string, translated: string, overrides: Partial<Prisma.MenuLinkUncheckedCreateInput> = {}) => {
        const text = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: caption },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: translated },
        ] } } });
        return tx.menuLink.create({ data: { publicId: generatePublicId(), bandId: band.id, captionId: text.id, groupName: "fixture",
            groupCssClass: "", itemCssClass: "", linkType: "external", visiblePermissionId: publicPermission.id, externalURI: "https://private.invalid", ...overrides } });
    };
    const custom = (name: string, overrides: Partial<Prisma.CustomLinkUncheckedCreateInput> = {}) => tx.customLink.create({ data: {
        publicId: generatePublicId(), bandId: band.id, name, description: "private", slug: generatePublicId(), redirectType: "Temporary", ...overrides,
    } });
    return { band, member, role, auth, snapshot, input, add, read, song, event, wiki, menu, custom, publicPermission, hiddenPermission };
}

