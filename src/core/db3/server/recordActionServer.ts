import { Ctx } from "blitz";
import db from "db";
import { z } from "zod";
import * as mutationCore from "../server/db3mutationCore";
import { ZTRecordActionArgs } from "../../components/featureReports/activityTracking";

type RecordActionArgs = z.infer<typeof ZTRecordActionArgs>;

/**
 * Shared logic for recording an action/telemetry event in the database.
 * Used by both recordActionMutation and the /api/telemetry endpoint.
 */
export async function createActionRecord({ uri, feature, context, deviceInfo, userId, isClient, ...associations }: RecordActionArgs & { userId?: number | null, isClient: boolean }) {
    await db.action.create({
        data: {
            userId,
            isClient,
            uri,
            feature,
            context,

            // device info...
            screenHeight: deviceInfo?.screenHeight,
            screenWidth: deviceInfo?.screenWidth,
            deviceClass: deviceInfo?.deviceClass,
            pointerType: deviceInfo?.pointer,
            browserName: deviceInfo?.browser,

            ...associations,
        },
    });
    console.log("[ActivityLog] Recorded action", { uri, feature, context, userId, isClient, associations });
}

// For legacy usage, keep the original recordAction for server-side/mutation
export async function recordAction({ userId, ...args }: RecordActionArgs, ctx: Ctx) {
    if (!userId) {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        userId = currentUser?.id;
    }
    await createActionRecord({ userId, isClient: false, ...args });
}