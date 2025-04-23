// recordActionMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import * as mutationCore from "../server/db3mutationCore";
import { ZTRecordActionArgs } from "../shared/activityTracking";

export default resolver.pipe(
    resolver.zod(ZTRecordActionArgs),
    async ({ uri, feature, context, deviceInfo, ...associations }, ctx: AuthenticatedCtx) => {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);

        await db.action.create({
            data: {
                userId: currentUser?.id,
                isClient: true,
                uri,
                feature,
                context,

                // device info...
                screenHeight: deviceInfo?.screenInfo?.height,
                screenWidth: deviceInfo?.screenInfo?.width,
                deviceClass: deviceInfo?.deviceClass,
                pointerType: deviceInfo?.pointer,
                browserName: deviceInfo?.browser,

                ...associations,
            },
        });

    }
);

