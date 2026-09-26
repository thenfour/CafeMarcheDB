import { resolver, type CMAuthenticatedCtx } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { gEventRelevanceClass } from "../shared/eventRelevance";
import { resolvePublicId } from "../server/db3PublicIds";

const ZArgs = z.object({
    eventId: db3.xEvent.identitySchema,
    relevanceClassOverrideName: z.string().nullable(),
});

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.cmauthorize(Permission.login),
    resolver.zod(ZArgs),
    async (args, ctx: CMAuthenticatedCtx) => {
        const eventId = await resolvePublicId(db3.xEvent, args.eventId, ctx.auth, db, true);
        const relevanceClassValue = args.relevanceClassOverrideName == null ? null : gEventRelevanceClass[args.relevanceClassOverrideName] || null;

        const fields: Prisma.EventUncheckedUpdateInput = {
            relevanceClassOverride: relevanceClassValue,
        };

        await mutationCore.updateImpl(db3.xEvent, eventId, fields, ctx);
        return args;
    }
);

