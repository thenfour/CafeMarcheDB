import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { z } from "zod";

const ZArgs = z.object({
    eventId: z.number(),
    relevanceClassOverrideName: z.string().nullable(),
});

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx) => {
        const relevanceClassValue = args.relevanceClassOverrideName == null ? null : db3.gEventRelevanceClass[args.relevanceClassOverrideName] || null;

        const fields: Prisma.EventUncheckedUpdateInput = {
            relevanceClassOverride: relevanceClassValue,
        };

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };
        await mutationCore.updateImpl(db3.xEvent, args.eventId, fields, ctx, clientIntention);
        return args;
    }
);

