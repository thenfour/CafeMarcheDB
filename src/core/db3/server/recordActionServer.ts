import { Ctx } from "blitz";
import db, { Prisma } from "db";
import { z } from "zod";
import { ZTRecordActionArgs } from "../../components/featureReports/activityTracking";
import * as mutationCore from "../server/db3mutationCore";

type RecordActionArgs = z.infer<typeof ZTRecordActionArgs>;

/**
 * Safely truncates a string to the specified maximum length
 */
function truncateString(value: string | null | undefined, maxLength: number): string | null {
    if (value == null) return null;
    if (typeof value !== 'string') return null;
    return value.length > maxLength ? value.substring(0, maxLength) : value;
}

/**
 * Safely converts a value to lowercase string with length limit
 */
function toLowerCaseString(value: string | null | undefined, maxLength: number): string | null {
    if (value == null) return null;
    if (typeof value !== 'string') return null;
    const lowerValue = value.toLowerCase();
    return lowerValue.length > maxLength ? lowerValue.substring(0, maxLength) : lowerValue;
}

/**
 * Safely converts a value to a positive integer within reasonable bounds
 */
function toSafeInteger(value: number | null | undefined): number | null {
    if (value == null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) return null;
    // Protect against unreasonably large values that could cause issues
    if (value < 0 || value > 2147483647) return null; // MySQL INT max value
    return value;
}

/**
 * Safely converts association ID values to valid integers
 */
function toSafeId(value: number | null | undefined): number | null {
    if (value == null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) return null;
    // IDs should be positive
    if (value <= 0 || value > 2147483647) return null;
    return value;
}

/**
 * Validates and sanitizes feature field against database constraints
 */
function sanitizeFeature(feature: string): string {
    if (typeof feature !== 'string') {
        throw new Error('Feature field is required and must be a string');
    }
    // Truncate to database limit if necessary
    const truncated = feature.length > 64 ? feature.substring(0, 64) : feature;
    // Note: Enum validation is handled by Zod schema validation before this point
    // This function focuses on database constraint compliance
    return truncated;
}

export const redactSensitiveActionUri = (uri: string | null | undefined): string | null => {
    if (uri == null) return null;
    return uri.replace(
        /(\/api\/ical\/user\/)[^/?#]+(\/upcoming)/gi,
        "$1[calendarFeedToken]$2",
    );
};

/**
 * Sanitizes all input fields according to database schema constraints.
 * 
 * This function implements a defense-in-depth approach:
 * - Truncates strings to database VARCHAR limits
 * - Normalizes case for fields that specify lowercase storage
 * - Validates numeric ranges and ensures safe integer values
 * - Handles null/undefined values gracefully
 * - Protects against SQL injection and data corruption
 * 
 * Note: Type and enum validation is handled by Zod schemas before this point.
 * This function focuses specifically on database constraint compliance.
 */
function sanitizeActionInputs(args: RecordActionArgs & { userId?: number | null, isClient: boolean }): Prisma.ActionUncheckedCreateInput {
    const { deviceInfo, ...otherArgs } = args;

    return {
        // Core fields
        userId: toSafeId(args.userId),
        isClient: Boolean(args.isClient),
        uri: truncateString(redactSensitiveActionUri(args.uri), 192),
        feature: sanitizeFeature(args.feature),
        context: truncateString(args.context, 256),
        queryText: truncateString(args.queryText, 64),

        // Device info fields - all with lowercase normalization where specified
        screenHeight: toSafeInteger(deviceInfo?.screenHeight),
        screenWidth: toSafeInteger(deviceInfo?.screenWidth),
        deviceClass: toLowerCaseString(deviceInfo?.deviceClass, 16),
        pointerType: toLowerCaseString(deviceInfo?.pointer, 16),
        browserName: toLowerCaseString(deviceInfo?.browser, 16),
        operatingSystem: toLowerCaseString(deviceInfo?.operatingSystem, 16),
        language: toLowerCaseString(deviceInfo?.language, 8),
        locale: toLowerCaseString(deviceInfo?.locale, 8),
        timezone: toLowerCaseString(deviceInfo?.timezone, 48),

        // Association IDs - all must be positive integers
        eventId: null,
        fileId: null,
        songId: null,
        wikiPageId: toSafeId(args.wikiPageId),
        attendanceId: null,
        eventSegmentId: null,
        customLinkId: toSafeId(args.customLinkId),
        eventSongListId: null,
        frontpageGalleryItemId: toSafeId(args.frontpageGalleryItemId),
        menuLinkId: toSafeId(args.menuLinkId),
        setlistPlanId: toSafeId(args.setlistPlanId),
        songCreditTypeId: null,
        instrumentId: null,
    };
}

/**
 * Shared logic for recording an action/telemetry event in the database.
 * Used by both recordActionMutation and the /api/telemetry endpoint.
 */
export async function createActionRecord(args: RecordActionArgs & { userId?: number | null, isClient: boolean }) {
    // Sanitize and validate all inputs according to database constraints
    const sanitizedData = sanitizeActionInputs(args);
    if (args.songId) {
        const song = await db.song.findUnique({
            where: { publicId: args.songId },
            select: { id: true },
        });
        sanitizedData.songId = song?.id ?? null;
    }
    if (args.fileId) {
        const file = await db.file.findUnique({
            where: { publicId: args.fileId },
            select: { id: true },
        });
        sanitizedData.fileId = file?.id ?? null;
    }
    if (args.eventId) {
        const event = await db.event.findUnique({
            where: { publicId: args.eventId },
            select: { id: true },
        });
        sanitizedData.eventId = event?.id ?? null;
    }
    if (args.instrumentId) {
        const instrument = await db.instrument.findUnique({
            where: { publicId: args.instrumentId },
            select: { id: true },
        });
        sanitizedData.instrumentId = instrument?.id ?? null;
    }
    if (args.songCreditTypeId) {
        const songCreditType = await db.songCreditType.findUnique({
            where: { publicId: args.songCreditTypeId },
            select: { id: true },
        });
        sanitizedData.songCreditTypeId = songCreditType?.id ?? null;
    }

    if (args.eventSegmentId) {
        const segment = await db.eventSegment.findUnique({
            where:
            {
                publicId: args.eventSegmentId
            },
            select: {
                id: true
            }
        });
        sanitizedData.eventSegmentId = segment?.id ?? null;
    }

    if (args.attendanceId) {
        const attendance = await db.eventAttendance.findUnique({ where: { publicId: args.attendanceId }, select: { id: true } });
        sanitizedData.attendanceId = attendance?.id ?? null;
    }

    if (args.eventSongListId) {
        const songList = await db.eventSongList.findUnique({
            where: { publicId: args.eventSongListId },
            select: { id: true },
        });
        sanitizedData.eventSongListId = songList?.id ?? null;
    }

    await db.action.create({
        data: sanitizedData,
    });

    // console.log("[ActivityLog] Recorded action", {
    //     uri: sanitizedData.uri,
    //     feature: sanitizedData.feature,
    //     context: sanitizedData.context,
    //     userId: sanitizedData.userId,
    //     isClient: sanitizedData.isClient
    // });
}

export async function recordAuthenticatedClientAction(args: RecordActionArgs, ctx: Ctx) {
    const currentUser = await mutationCore.getCurrentUserCore(ctx);
    await createActionRecord({
        ...args,
        userId: currentUser?.id,
        isClient: true,
    });
}

// For legacy usage, keep the original recordAction for server-side/mutation
export async function recordAction({ userId, ...args }: RecordActionArgs, ctx: Ctx) {
    if (!userId) {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        userId = currentUser?.id;
    }
    await createActionRecord({ userId, isClient: false, ...args });
}
