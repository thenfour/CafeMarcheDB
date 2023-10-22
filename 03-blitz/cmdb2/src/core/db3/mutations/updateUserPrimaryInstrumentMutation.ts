import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateUserPrimaryInstrumentMutationArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TupdateUserPrimaryInstrumentMutationArgs, ctx: AuthenticatedMiddlewareCtx) => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

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
            if (ei.instrumentId === args.instrumentId) newId = ei.id;
        }

        for (let i = 0; i < existingIds.length; ++i) {
            await mutationCore.updateImpl(db3.xUserInstrument, existingIds[i]!, {
                isPrimary: false,
            }, ctx, clientIntention);
        }

        if (newId) {
            await mutationCore.updateImpl(db3.xUserInstrument, newId, {
                isPrimary: true,
            }, ctx, clientIntention);
        }

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

