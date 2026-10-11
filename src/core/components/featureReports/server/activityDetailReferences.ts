import { activityReferenceField, activityReferenceLabel, correlateActivityReferences, readActivityReferenceView } from "./activityReferenceRead";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import type { DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { fileReferenceView, frontpageGalleryItemReferenceView } from "src/core/db3/shared/entities/file/fileReferences";
import { eventSegmentReferenceView } from "src/core/db3/shared/entities/event/eventSegmentReferences";
import { eventSongListReferenceView } from "src/core/db3/shared/entities/eventSongList/eventSongListReferences";
import { eventAttendanceReferenceView } from "src/core/db3/shared/entities/event/eventCatalogs";
import { setlistPlanReferenceView } from "src/core/db3/shared/entities/setlistPlan/setlistPlanReferences";
import { songCreditTypeReferenceView } from "src/core/db3/shared/entities/song/songCreditTypes";
import { bandInstrumentReferenceView, bandInstrumentGroupReferenceView } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import type { ActivityFileReference, ActivitySegmentReference, ActivitySetlistReference, ActivityGalleryReference, ActivityPlanReference,
    ActivityCreditTypeReference, ActivityAttendanceReference, ActivityInstrumentReference, FacetedBreakdownInput } from "../activityReportTypes";

interface ActivityDetailReferenceIds {
    readonly fileId: number | null; readonly eventSegmentId: number | null; readonly eventSongListId: number | null;
    readonly frontpageGalleryItemId: number | null; readonly setlistPlanId: number | null; readonly songCreditTypeId: number | null;
    readonly attendanceId: number | null; readonly bandInstrumentId: number | null;
}
export interface ActivityAuthorizedDetailReferences {
    readonly files: ReadonlyMap<number, ActivityFileReference>; readonly segments: ReadonlyMap<number, ActivitySegmentReference>;
    readonly setlists: ReadonlyMap<number, ActivitySetlistReference>; readonly galleryItems: ReadonlyMap<number, ActivityGalleryReference>;
    readonly plans: ReadonlyMap<number, ActivityPlanReference>; readonly creditTypes: ReadonlyMap<number, ActivityCreditTypeReference>;
    readonly attendance: ReadonlyMap<number, ActivityAttendanceReference>; readonly instruments: ReadonlyMap<number, ActivityInstrumentReference>;
}

function referencedIds(rows: readonly ActivityDetailReferenceIds[], field: keyof ActivityDetailReferenceIds): number[] {
    return [...new Set(rows.flatMap(row => row[field] === null ? [] : [row[field]]))];
}

/** Only the returned Action rows supply candidates; every public field comes from an authorized entity view. */
export async function readActivityDetailReferences(context: DB3ReadContext, input: FacetedBreakdownInput,
    rows: readonly ActivityDetailReferenceIds[]): Promise<ActivityAuthorizedDetailReferences> {
    const identities = await readDetailReferenceIdentities(context, rows);
    const references = await readDetailReferenceViews(context, input, identities);
    return projectDetailReferences(identities, references);
}

async function readDetailReferenceIdentities(context: DB3ReadContext, rows: readonly ActivityDetailReferenceIds[]) {
    const bandId = context.authorization.requireBand().id;
    const database = context.database;
    const fileIds = await database.file.findMany({ where: { bandId, id: { in: referencedIds(rows, "fileId") } }, select: { id: true, publicId: true } });
    const segmentIds = await database.eventSegment.findMany({ where: { event: { bandId }, id: { in: referencedIds(rows, "eventSegmentId") } }, select: { id: true, publicId: true } });
    const setlistIds = await database.eventSongList.findMany({ where: { event: { bandId }, id: { in: referencedIds(rows, "eventSongListId") } }, select: { id: true, publicId: true } });
    const galleryIds = await database.frontpageGalleryItem.findMany({ where: { file: { bandId }, id: { in: referencedIds(rows, "frontpageGalleryItemId") } }, select: { id: true, publicId: true } });
    const planIds = await database.setlistPlan.findMany({ where: { bandId, id: { in: referencedIds(rows, "setlistPlanId") } }, select: { id: true, publicId: true } });
    const instrumentIds = await database.bandInstrument.findMany({ where: { bandId, id: { in: referencedIds(rows, "bandInstrumentId") } }, select: { id: true, publicId: true } });
    // Attendance and credit types are shared global catalogs, not membership or person records.
    const attendanceIds = await database.eventAttendance.findMany({ where: { id: { in: referencedIds(rows, "attendanceId") } }, select: { id: true, publicId: true } });
    const creditIds = await database.songCreditType.findMany({ where: { id: { in: referencedIds(rows, "songCreditTypeId") } }, select: { id: true, publicId: true } });
    return { fileIds, segmentIds, setlistIds, galleryIds, planIds, instrumentIds, attendanceIds, creditIds };
}
type DetailReferenceIdentities = Awaited<ReturnType<typeof readDetailReferenceIdentities>>;

async function readDetailReferenceViews(context: DB3ReadContext, input: FacetedBreakdownInput, identities: DetailReferenceIdentities) {
    const { fileIds, segmentIds, setlistIds, galleryIds, planIds, instrumentIds, attendanceIds, creditIds } = identities;
    const preferences = { bandPublicId: input.bandPublicId, routeLocale: input.routeLocale, browserLanguages: input.browserLanguages,
        cmdbQueryContext: "activity detail references" };
    const files = await readActivityReferenceView(context, { ...preferences, view: fileReferenceView, filter: { publicIds: fileIds.map(row => parsePublicId<"File">(row.publicId)) } });
    const segments = await readActivityReferenceView(context, { ...preferences, view: eventSegmentReferenceView, filter: { publicIds: segmentIds.map(row => parsePublicId<"EventSegment">(row.publicId)) } });
    const setlists = await readActivityReferenceView(context, { ...preferences, view: eventSongListReferenceView, filter: { publicIds: setlistIds.map(row => parsePublicId<"EventSongList">(row.publicId)) } });
    const gallery = await readActivityReferenceView(context, { ...preferences, view: frontpageGalleryItemReferenceView, filter: { publicIds: galleryIds.map(row => parsePublicId<"FrontpageGalleryItem">(row.publicId)) } });
    const plans = await readActivityReferenceView(context, { ...preferences, view: setlistPlanReferenceView, filter: { publicIds: planIds.map(row => parsePublicId<"SetlistPlan">(row.publicId)) } });
    const attendance = await readActivityReferenceView(context, { ...preferences, view: eventAttendanceReferenceView, filter: { publicIds: attendanceIds.map(row => parsePublicId<"EventAttendance">(row.publicId)) } });
    const credits = await readActivityReferenceView(context, { ...preferences, view: songCreditTypeReferenceView, filter: { publicIds: creditIds.map(row => parsePublicId<"SongCreditType">(row.publicId)) } });
    const instruments = await readActivityReferenceView(context, { ...preferences, view: bandInstrumentReferenceView, filter: {
        publicIds: instrumentIds.map(row => parsePublicId<"Instrument">(row.publicId)),
        tableParams: { includeHidden: context.authorization.hasPermission(Permission.admin_instruments) },
    } });
    const instrumentGroups = await readActivityReferenceView(context, { ...preferences, view: bandInstrumentGroupReferenceView, filter: {
        publicIds: instruments.flatMap(row => row.functionalGroupId === undefined ? [] : [row.functionalGroupId]),
        tableParams: { includeHidden: context.authorization.hasPermission(Permission.admin_instruments) },
    } });
    return { files, segments, setlists, gallery, plans, attendance, credits, instruments, instrumentGroups };
}
type DetailReferenceViews = Awaited<ReturnType<typeof readDetailReferenceViews>>;

function projectDetailReferences(identities: DetailReferenceIdentities, references: DetailReferenceViews): ActivityAuthorizedDetailReferences {
    const { fileIds, segmentIds, setlistIds, galleryIds, planIds, instrumentIds, attendanceIds, creditIds } = identities;
    const { files, segments, setlists, gallery, plans, attendance, credits, instruments, instrumentGroups } = references;
    const groupColors = new Map<string, string | null>(instrumentGroups.map(row => [row.publicId, activityReferenceField(row.color)]));
    return {
        files: correlateActivityReferences(fileIds, files.map(row => ({ publicId: row.publicId, fileLeafName: activityReferenceLabel(row.fileLeafName) }))),
        segments: correlateActivityReferences(segmentIds, segments.map(row => ({ publicId: row.publicId, name: activityReferenceLabel(row.name),
            eventId: activityReferenceField(row.eventId), startsAt: activityReferenceField(row.startsAt) }))),
        setlists: correlateActivityReferences(setlistIds, setlists.map(row => ({ publicId: row.publicId, name: activityReferenceLabel(row.name), eventId: activityReferenceField(row.eventId) }))),
        galleryItems: correlateActivityReferences(galleryIds, gallery.map(row => ({ publicId: row.publicId, fileId: activityReferenceField(row.fileId) }))),
        plans: correlateActivityReferences(planIds, plans.map(row => ({ publicId: row.publicId, name: activityReferenceLabel(row.name) }))),
        attendance: correlateActivityReferences(attendanceIds, attendance.map(row => ({ publicId: row.publicId, buttonCaption: activityReferenceLabel(row.buttonCaption),
            description: activityReferenceLabel(row.description), color: activityReferenceField(row.color), iconName: activityReferenceField(row.iconName) }))),
        creditTypes: correlateActivityReferences(creditIds, credits.map(row => ({ publicId: row.publicId, name: activityReferenceLabel(row.name), color: activityReferenceField(row.color) }))),
        instruments: correlateActivityReferences(instrumentIds, instruments.flatMap(row => {
            const color = row.functionalGroupId === undefined ? undefined : groupColors.get(row.functionalGroupId);
            if (color === undefined) {
                return [];
            }
            return [{ publicId: row.publicId, name: activityReferenceLabel(row.name), color }];
        })),
    };
}
