import { cmauthorize, type CMAuthCtxWithUser } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { resolvePublicId } from "../server/db3PublicIds";
import { gEventRelevanceClass } from "../shared/eventRelevance";

const ZArgs = z.object({
    eventId: db3.xEvent.identitySchema,
    relevanceClassOverrideName: z.string().nullable(),
});

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    cmauthorize(Permission.login),
    resolver.zod(ZArgs),
    async (args, ctx: CMAuthCtxWithUser) => {
        const eventId = await resolvePublicId(db3.xEvent, args.eventId, ctx.auth, db, true);
        const relevanceClassValue = args.relevanceClassOverrideName == null ? null : gEventRelevanceClass[args.relevanceClassOverrideName] || null;

        const fields: Prisma.EventUncheckedUpdateInput = {
            relevanceClassOverride: relevanceClassValue,
        };

        await mutationCore.updateImpl(db3.xEvent, eventId, fields, ctx.auth);
        return args;
    }
);

