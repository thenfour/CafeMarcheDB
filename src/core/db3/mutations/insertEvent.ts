// insertEvent
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, assert } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TinsertEventArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TinsertEventArgs, ctx: AuthenticatedCtx) => {

        // TODO
        //CMDBAuthorizeOrThrow("insertEvent", Permission.comm)

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        assert(!!currentUser, "user required to insert an event")
        const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser, };

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const eventFields: Prisma.EventUncheckedCreateInput & { tags: number[] } = {
            createdAt: new Date(), // this is automatic though right?
            createdByUserId: currentUser.id,
            name: args.event.name,
            description: args.event.description || "",
            slug: args.event.slug,
            typeId: args.event.typeId,
            statusId: args.event.statusId,
            tags: args.event.tags,
            revision: 0,
            expectedAttendanceUserTagId: args.event.expectedAttendanceUserTagId,
            visiblePermissionId: args.event.visiblePermissionId,
        };

        // create the root event,
        const newEvent = await mutationCore.insertImpl(db3.xEvent, eventFields, ctx, clientIntention) as db3.EventPayloadMinimum;

        const segmentFields: Prisma.EventSegmentUncheckedCreateInput = {
            name: args.segment.name || "Set 1",
            description: args.segment.description || "",
            eventId: newEvent.id,
            startsAt: args.segment.startsAt,
            durationMillis: args.segment.durationMillis,
            isAllDay: args.segment.isAllDay,
        };

        // create the initial segment.
        const segment = await mutationCore.insertImpl(db3.xEventSegment, segmentFields, ctx, clientIntention) as db3.EventSegmentPayloadMinimum;

        // create song lists
        if (args.songList) {
            // create the song list
            const songListFields: Partial<db3.EventSongListPayload> = {
                userId: currentUser.id,
                eventId: newEvent.id,
                description: "",
                event: newEvent,
                name: "Setlist",
                sortOrder: 0,
                //songs: [],
                //id: 0,
            };
            const songList = await mutationCore.insertImpl(db3.xEventSongList, songListFields, ctx, clientIntention) as db3.EventSongListPayload;
            // add songs.
            args.songList.forEach(async (s, i) => {
                const songFields: Partial<db3.EventSongListSongPayload> = {
                    eventSongListId: songList.id,
                    //id: 0,
                    //song: null,
                    songId: s.songId,
                    sortOrder: i,
                    subtitle: s.comment || "",
                };
                await mutationCore.insertImpl(db3.xEventSongListSong, songFields, ctx, clientIntention);
            });
        }

        // create user responses.
        if (args.responses) {
            args.responses.forEach(async (r) => {
                const responseFields: Partial<db3.EventSegmentUserResponsePayload> = {
                    eventSegmentId: segment.id,
                    attendanceId: r.attendanceId,
                    userId: r.userId,
                };
                await mutationCore.insertImpl(db3.xEventSegmentUserResponse, responseFields, ctx, clientIntention);
            });
        }

        return {
            event: newEvent,
            segment,
        };
    }
);

