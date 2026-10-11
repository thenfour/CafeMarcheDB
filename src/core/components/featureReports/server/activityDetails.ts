import { Prisma } from "@prisma/client";
import { executeDB3Read, type DB3ReadContext, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { ActivityDetailInputSchema, type ActivityDetailInput, type ActivityDetailResult, type ActivityDetailRow,
    type ActivityDetailSelection, type FacetedBreakdownInput } from "../activityReportTypes";
import { anonymousActivityContext } from "../activityContext";
import { activityParticipantToken, activityRowToken } from "./activityAnonymization";
import { authorizeActivityReport } from "./activityReportAuthorization";
import { activityFacetBaseWhere, activityFacetReferenceWhere } from "./activityFacetSelection";
import { activityReferencesById, authorizedActivityReferenceIds, readActivityFacetReferences, type ActivityAuthorizedReferences } from "./activityFacetReferences";
import { readActivityDetailReferences, type ActivityAuthorizedDetailReferences } from "./activityDetailReferences";

// Preserve the original 200-row detail limit, with an exact total and stable newest-first ordering.
const activityDetailRowLimit = 200;

/** Natural identities stay server-side. Saved URLs/searches and person relations are never selected. */
export const activityDetailSelection = Prisma.validator<Prisma.ActionDefaultArgs>()({ select: {
    id: true, createdAt: true, userId: true, feature: true, context: true, isClient: true,
    pointerType: true, screenWidth: true, screenHeight: true, deviceClass: true, browserName: true,
    operatingSystem: true, language: true, locale: true, timezone: true,
    songId: true, eventId: true, wikiPageId: true, menuLinkId: true, customLinkId: true,
    fileId: true, eventSegmentId: true, eventSongListId: true, frontpageGalleryItemId: true,
    setlistPlanId: true, songCreditTypeId: true, attendanceId: true, bandInstrumentId: true,
} });
type ActivityDatabaseRow = Prisma.ActionGetPayload<typeof activityDetailSelection>;

export function projectActivityDetailRows(rows: readonly ActivityDatabaseRow[], references: ActivityAuthorizedReferences,
    auxiliary: ActivityAuthorizedDetailReferences, input: FacetedBreakdownInput): ActivityDetailRow[] {
    const songs = activityReferencesById(references.songs), events = activityReferencesById(references.events);
    const wiki = activityReferencesById(references.wikiPages), menu = activityReferencesById(references.menuLinks);
    const custom = activityReferencesById(references.customLinks);
    return rows.map(row => ({
        rowKey: activityRowToken(row.id, input), createdAt: row.createdAt,
        userHash: row.userId === null ? null : activityParticipantToken(row.userId, input),
        feature: row.feature, context: anonymousActivityContext(row.context), isClient: row.isClient,
        pointerType: row.pointerType, screenWidth: row.screenWidth, screenHeight: row.screenHeight,
        deviceClass: row.deviceClass, browserName: row.browserName, operatingSystem: row.operatingSystem,
        language: row.language, locale: row.locale, timezone: row.timezone,
        song: row.songId === null ? null : songs.get(row.songId) ?? null,
        event: row.eventId === null ? null : events.get(row.eventId) ?? null,
        wikiPage: row.wikiPageId === null ? null : wiki.get(row.wikiPageId) ?? null,
        menuLink: row.menuLinkId === null ? null : menu.get(row.menuLinkId) ?? null,
        customLink: row.customLinkId === null ? null : custom.get(row.customLinkId) ?? null,
        file: row.fileId === null ? null : auxiliary.files.get(row.fileId) ?? null,
        eventSegment: row.eventSegmentId === null ? null : auxiliary.segments.get(row.eventSegmentId) ?? null,
        eventSongList: row.eventSongListId === null ? null : auxiliary.setlists.get(row.eventSongListId) ?? null,
        frontpageGalleryItem: row.frontpageGalleryItemId === null ? null : auxiliary.galleryItems.get(row.frontpageGalleryItemId) ?? null,
        setlistPlan: row.setlistPlanId === null ? null : auxiliary.plans.get(row.setlistPlanId) ?? null,
        songCreditType: row.songCreditTypeId === null ? null : auxiliary.creditTypes.get(row.songCreditTypeId) ?? null,
        attendance: row.attendanceId === null ? null : auxiliary.attendance.get(row.attendanceId) ?? null,
        instrument: row.bandInstrumentId === null ? null : auxiliary.instruments.get(row.bandInstrumentId) ?? null,
    }));
}

function detailWhere(base: Prisma.ActionWhereInput, detail: ActivityDetailSelection, references: ActivityAuthorizedReferences): Prisma.ActionWhereInput {
    return { AND: [base, drilldownCondition(detail, references)] };
}

function drilldownCondition(detail: ActivityDetailSelection, references: ActivityAuthorizedReferences): Prisma.ActionWhereInput {
    switch (detail.facet) {
        case "total":
            return {};
        case "features":
            return { feature: detail.key };
        case "contexts":
            return { context: { startsWith: detail.key.replace(/[\\%_]/g, "\\$&") } };
        case "operatingSystems":
            return { operatingSystem: detail.key };
        case "pointerTypes":
            return { pointerType: detail.key };
        case "browsers":
            return { browserName: detail.key };
        case "deviceClasses":
            return { deviceClass: detail.key };
        case "languages":
            return { language: detail.key };
        case "locales":
            return { locale: detail.key };
        case "timezones":
            return { timezone: detail.key };
        case "songs":
            return { songId: { in: authorizedActivityReferenceIds(references.songs, [detail.key]) } };
        case "events":
            return { eventId: { in: authorizedActivityReferenceIds(references.events, [detail.key]) } };
        case "wikiPages":
            return { wikiPageId: { in: authorizedActivityReferenceIds(references.wikiPages, [detail.key]) } };
        case "menuLinks":
            return { menuLinkId: { in: authorizedActivityReferenceIds(references.menuLinks, [detail.key]) } };
        case "customLinks":
            return { customLinkId: { in: authorizedActivityReferenceIds(references.customLinks, [detail.key]) } };
    }
}

async function selectionReferences(context: DB3ReadContext, input: ActivityDetailInput, where: Prisma.ActionWhereInput) {
    const groups = await context.database.action.groupBy({ by: ["songId", "eventId", "wikiPageId", "menuLinkId", "customLinkId"], where });
    return readActivityFacetReferences(context, input, {
        songIds: groups.flatMap(row => row.songId === null ? [] : [row.songId]),
        eventIds: groups.flatMap(row => row.eventId === null ? [] : [row.eventId]),
        wikiPageIds: groups.flatMap(row => row.wikiPageId === null ? [] : [row.wikiPageId]),
        menuLinkIds: groups.flatMap(row => row.menuLinkId === null ? [] : [row.menuLinkId]),
        customLinkIds: groups.flatMap(row => row.customLinkId === null ? [] : [row.customLinkId]),
    });
}

export function readActivityDetails(database: DB3ReadDatabase, authorization: DB3ReadContext["authorization"], input: ActivityDetailInput): Promise<ActivityDetailResult> {
    const args = ActivityDetailInputSchema.parse(input);
    return executeDB3Read(database, authorization, async context => {
        const { band } = authorizeActivityReport(context.authorization, args.bandPublicId);
        const timeZone = await loadBandTimeZone(context.database, band.id);
        const start = performance.now();
        const base = await activityFacetBaseWhere(context, args, timeZone);
        const references = await selectionReferences(context, args, base);
        const filtered = activityFacetReferenceWhere(base, args, references);
        const where = detailWhere(filtered, args.detail, references);
        const totalRowCount = await context.database.action.count({ where });
        const rows = await context.database.action.findMany({ ...activityDetailSelection, where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: activityDetailRowLimit });
        const auxiliary = await readActivityDetailReferences(context, args, rows);
        return { rows: projectActivityDetailRows(rows, references, auxiliary, args), timeZone, rowLimit: activityDetailRowLimit,
            metrics: { totalRowCount, queryTimeMs: Math.round(performance.now() - start) } };
    });
}
