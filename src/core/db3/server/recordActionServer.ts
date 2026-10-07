import type { CMServerAuthorization } from "@/src/auth/server/serverAuthorization";
import { AuthorizationError } from "blitz";
import db, { Prisma } from "db";
import { collectLocalePreferences, selectFormattingLocale } from "src/locale/shared/localePreferences";
import type { z } from "zod";
import type { ClientActionRequest, ZTRecordActionArgs } from "../../components/featureReports/activityTracking";

type RecordActionArgs = z.infer<typeof ZTRecordActionArgs>;
type ServerActionArgs = RecordActionArgs & { userId?: number | null; isClient: boolean };
type ActionDatabase = Pick<Prisma.TransactionClient, "action" | "song" | "customLink" | "menuLink"
    | "wikiPage" | "file" | "frontpageGalleryItem" | "event" | "bandInstrument"
    | "songCreditType" | "eventSegment" | "eventAttendance" | "eventSongList" | "setlistPlan">;

// Blitz enhances these delegates; this service uses the standard Prisma API.
const actionDatabase = db as unknown as ActionDatabase;

export interface ActionContext {
    readonly bandId: number | null;
    readonly localeContextId: number | null;
}

function truncateString(value: string | null | undefined, maxLength: number): string | null {
    if (typeof value !== "string") {
        return null;
    }
    return value.substring(0, maxLength);
}

function toLowerCaseString(value: string | undefined, maxLength: number): string | null {
    return truncateString(typeof value === "string" ? value.toLowerCase() : null, maxLength);
}

function toSafeInteger(value: number | null | undefined, minimum: number): number | null {
    if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > 2147483647) {
        return null;
    }
    return value;
}

export function redactSensitiveActionUri(uri: string | null | undefined): string | null {
    if (uri == null) {
        return null;
    }
    return uri.replace(/(\/api\/ical\/user\/)[^/?#]+(\/upcoming)/gi, "$1[calendarFeedToken]$2");
}

function sanitizeActionInputs(args: ServerActionArgs, context: ActionContext): Prisma.ActionUncheckedCreateInput {
    const { deviceInfo } = args;
    return {
        userId: toSafeInteger(args.userId, 1),
        bandId: context.bandId,
        localeContextId: context.localeContextId,
        isClient: args.isClient,
        uri: truncateString(redactSensitiveActionUri(args.uri), 192),
        feature: args.feature.substring(0, 64),
        context: truncateString(args.context, 256),
        queryText: truncateString(args.queryText, 64),
        screenHeight: toSafeInteger(deviceInfo?.screenHeight, 0),
        screenWidth: toSafeInteger(deviceInfo?.screenWidth, 0),
        deviceClass: toLowerCaseString(deviceInfo?.deviceClass, 16),
        pointerType: toLowerCaseString(deviceInfo?.pointer, 16),
        browserName: toLowerCaseString(deviceInfo?.browser, 16),
        operatingSystem: toLowerCaseString(deviceInfo?.operatingSystem, 16),
        language: toLowerCaseString(deviceInfo?.language, 8),
        locale: toLowerCaseString(deviceInfo?.locale, 8),
        timezone: toLowerCaseString(deviceInfo?.timezone, 48),
    };
}

// Missing and foreign-band references are omitted, as with unknown telemetry IDs.
// Child rows inherit ownership through their event or file, never through the client.
async function resolveBandAssociations(database: ActionDatabase, args: RecordActionArgs, bandId: number | null) {
    const [song, customLink, menuLink, wikiPage, file, galleryItem, event, instrument, segment, songList, plan] = bandId === null
        ? [] : await Promise.all([
            args.songId ? database.song.findFirst({ where: { publicId: args.songId, bandId }, select: { id: true } }) : null,
            args.customLinkId ? database.customLink.findFirst({ where: { publicId: args.customLinkId, bandId }, select: { id: true } }) : null,
            args.menuLinkId ? database.menuLink.findFirst({ where: { publicId: args.menuLinkId, bandId }, select: { id: true } }) : null,
            args.wikiPageId ? database.wikiPage.findFirst({ where: { publicId: args.wikiPageId, bandId }, select: { id: true } }) : null,
            args.fileId ? database.file.findFirst({ where: { publicId: args.fileId, bandId }, select: { id: true } }) : null,
            args.frontpageGalleryItemId ? database.frontpageGalleryItem.findFirst({ where: { publicId: args.frontpageGalleryItemId, file: { bandId } }, select: { id: true } }) : null,
            args.eventId ? database.event.findFirst({ where: { publicId: args.eventId, bandId }, select: { id: true } }) : null,
            args.bandInstrumentId ? database.bandInstrument.findFirst({ where: { publicId: args.bandInstrumentId, bandId }, select: { id: true } }) : null,
            args.eventSegmentId ? database.eventSegment.findFirst({ where: { publicId: args.eventSegmentId, event: { bandId } }, select: { id: true } }) : null,
            args.eventSongListId ? database.eventSongList.findFirst({ where: { publicId: args.eventSongListId, event: { bandId } }, select: { id: true } }) : null,
            args.setlistPlanId ? database.setlistPlan.findFirst({ where: { publicId: args.setlistPlanId, bandId }, select: { id: true } }) : null,
        ]);
    return {
        songId: song?.id ?? null,
        customLinkId: customLink?.id ?? null,
        menuLinkId: menuLink?.id ?? null,
        wikiPageId: wikiPage?.id ?? null,
        fileId: file?.id ?? null,
        frontpageGalleryItemId: galleryItem?.id ?? null,
        eventId: event?.id ?? null,
        bandInstrumentId: instrument?.id ?? null,
        eventSegmentId: segment?.id ?? null,
        eventSongListId: songList?.id ?? null,
        setlistPlanId: plan?.id ?? null,
    };
}

async function resolveGlobalAssociations(database: ActionDatabase, args: RecordActionArgs) {
    const [creditType, attendance] = await Promise.all([
        args.songCreditTypeId ? database.songCreditType.findUnique({ where: { publicId: args.songCreditTypeId }, select: { id: true } }) : null,
        args.attendanceId ? database.eventAttendance.findUnique({ where: { publicId: args.attendanceId }, select: { id: true } }) : null,
    ]);
    return { songCreditTypeId: creditType?.id ?? null, attendanceId: attendance?.id ?? null };
}

/** Server callers supply trusted context explicitly; platform/unknown context uses nulls. */
export async function createActionRecord(args: ServerActionArgs, context: ActionContext, database: ActionDatabase = actionDatabase): Promise<void> {
    const [bandAssociations, globalAssociations] = await Promise.all([
        resolveBandAssociations(database, args, context.bandId),
        resolveGlobalAssociations(database, args),
    ]);
    await database.action.create({ data: {
        ...sanitizeActionInputs(args, context), ...bandAssociations, ...globalAssociations,
    } });
}

export async function recordAuthenticatedClientAction(request: ClientActionRequest, auth: CMServerAuthorization): Promise<void> {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
        const freshAuth = await auth.refresh(tx);
        if ((freshAuth.band?.publicId ?? null) !== (request.presentation.bandPublicId ?? null)) {
            throw new AuthorizationError("Telemetry context does not match the selected band.");
        }
        const formattingLocale = selectFormattingLocale(collectLocalePreferences(request.presentation));
        // Formatting can use an unregistered locale. Keep that context unknown rather than inventing a row.
        const locale = await tx.locale.findFirst({ where: { ietfTag: formattingLocale, isDeleted: false }, select: { id: true } });
        await createActionRecord({ ...request.event, userId: freshAuth.userId, isClient: true }, {
            bandId: freshAuth.band?.id ?? null,
            localeContextId: locale?.id ?? null,
        }, tx);
    }, { isolationLevel: "RepeatableRead" });
}
