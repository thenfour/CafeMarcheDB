import { Ctx } from "blitz";
import db from "db";
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
function sanitizeActionInputs(args: RecordActionArgs & { userId?: number | null, isClient: boolean }) {
    const { deviceInfo, ...otherArgs } = args;

    return {
        // Core fields
        userId: toSafeId(args.userId),
        isClient: Boolean(args.isClient),
        uri: truncateString(args.uri, 192),
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
        eventId: toSafeId(args.eventId),
        fileId: toSafeId(args.fileId),
        songId: toSafeId(args.songId),
        wikiPageId: toSafeId(args.wikiPageId),
        attendanceId: toSafeId(args.attendanceId),
        eventSegmentId: toSafeId(args.eventSegmentId),
        customLinkId: toSafeId(args.customLinkId),
        eventSongListId: toSafeId(args.eventSongListId),
        frontpageGalleryItemId: toSafeId(args.frontpageGalleryItemId),
        menuLinkId: toSafeId(args.menuLinkId),
        setlistPlanId: toSafeId(args.setlistPlanId),
        songCreditTypeId: toSafeId(args.songCreditTypeId),
        instrumentId: toSafeId(args.instrumentId),
    };
}

/**
 * Shared logic for recording an action/telemetry event in the database.
 * Used by both recordActionMutation and the /api/telemetry endpoint.
 */
export async function createActionRecord(args: RecordActionArgs & { userId?: number | null, isClient: boolean }) {
    // Sanitize and validate all inputs according to database constraints
    const sanitizedData = sanitizeActionInputs(args);

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

// For legacy usage, keep the original recordAction for server-side/mutation
export async function recordAction({ userId, ...args }: RecordActionArgs, ctx: Ctx) {
    if (!userId) {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        userId = currentUser?.id;
    }
    await createActionRecord({ userId, isClient: false, ...args });
}