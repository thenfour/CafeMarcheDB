// insertEvent
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TinsertEventArgs } from "../shared/apiTypes";
import { CMDBAuthorizeOrThrow } from "types";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TinsertEventArgs, ctx: AuthenticatedMiddlewareCtx) => {

        // TODO
        //CMDBAuthorizeOrThrow("insertEvent", Permission.comm)

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser, };

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const eventFields: Prisma.EventUncheckedCreateInput & { tags: number[] } = {
            createdAt: new Date(), // this is automatic though right?
            createdByUserId: currentUser.id,
            name: args.event.name,
            description: args.event.description,
            slug: args.event.slug,
            typeId: args.event.typeId,
            statusId: args.event.statusId,
            tags: args.event.tags,
            visiblePermissionId: args.event.visiblePermissionId,
        };

        // create the root event,
        //debugger;
        const newEvent = await mutationCore.insertImpl(db3.xEvent, eventFields, ctx, clientIntention) as db3.EventPayloadMinimum;

        const segmentFields: Prisma.EventSegmentUncheckedCreateInput = {
            name: args.segment.name,
            description: args.segment.description,
            eventId: newEvent.id,
            startsAt: args.segment.startsAt,
            endsAt: args.segment.endsAt,
        };

        // create the initial segment.
        await mutationCore.insertImpl(db3.xEventSegment, segmentFields, ctx, clientIntention);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

