import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateUserPrimaryInstrumentMutationArgs } from "../shared/apiTypes";
import { resolvePublicId } from "../server/db3PublicIds";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TupdateUserPrimaryInstrumentMutationArgs, ctx: AuthenticatedCtx) => {
        const requestAuthorization = await getRequestAuthorization(ctx.session);
        const publicData = db3.createDB3Authorization(
            requestAuthorization.user,
            requestAuthorization.effectivePermissions,
        );
        const instrumentId = await resolvePublicId(db3.xInstrument, args.instrumentId, publicData, db);

        // load ALL instruments because it's always a small list,
        // and we want to get multiple data:
        // - where is primary already
        // - and, the new instrument id.
        // this could be done in SQL with like, UPDATE UserInstruments SET isPrimary = (u.instrumentId = requestedId) WHERE userID = userID
        const existingInstruments = await db.userInstrument.findMany({
            where: {
                userId: args.userId,
            }
        });
        if (!existingInstruments) {
            return args;
        }
        const existingIds: number[] = [];
        let newId: number | null = null;

        for (let i = 0; i < existingInstruments.length; ++i) {
            const ei = existingInstruments[i]!;
            if (ei.isPrimary) existingIds.push(ei.id);
            if (ei.instrumentId === instrumentId) newId = ei.id;
        }

        for (let i = 0; i < existingIds.length; ++i) {
            await mutationCore.updateImpl(db3.xUserInstrument, existingIds[i]!, {
                isPrimary: false,
            }, ctx);
        }

        if (newId) {
            await mutationCore.updateImpl(db3.xUserInstrument, newId, {
                isPrimary: true,
            }, ctx);
        }

        return args;
    }
);

