// insertEvent
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, assert } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TinsertEventArgs } from "../shared/apiTypes";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { authorizeAndProjectDB3ViewModel, resolvePublicForeignIds, resolvePublicId } from "../server/db3PublicIds";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TinsertEventArgs, ctx: AuthenticatedCtx) => {

        return db.$transaction(async tx => {
            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            assert(!!currentUser, "user required to insert an event")


            const authorization = await getRequestAuthorization(ctx.session);
            const publicData = db3.createDB3Authorization(
                authorization.user,
                authorization.effectivePermissions,
            );
            const resolvedEventFields = await resolvePublicForeignIds(
                db3.xEvent,
                args.event,
                publicData,
                tx,
            );

            // Verbose on purpose in order to validate the resolved model against
            // Prisma's natural-key input at the trusted server boundary.
            const eventFields: Omit<Prisma.EventUncheckedCreateInput, "publicId"> & { tags: number[] } = {
                //createdAt: new Date(), // this is automatic though right?
                //createdByUserId: currentUser.id, // done in impl
                //updatedAt: new Date(), // this is automatic though right?
                name: resolvedEventFields.name,
                locationDescription: resolvedEventFields.locationDescription || "",
                //description: args.event.description || "",
                //slug: args.event.slug,
                typeId: resolvedEventFields.typeId,
                statusId: resolvedEventFields.statusId,
                tags: resolvedEventFields.tags,
                revision: 0,
                expectedAttendanceUserTagId: resolvedEventFields.expectedAttendanceUserTagId,
                visiblePermissionId: resolvedEventFields.visiblePermissionId,
            };

            // create the root event,
            const newEvent = await mutationCore.insertImpl(db3.xEvent, eventFields, ctx, tx) as Prisma.EventGetPayload<{}>;

            const segmentFields: Omit<Prisma.EventSegmentUncheckedCreateInput, "publicId"> = {
                name: args.segment.name || "Set 1",
                description: args.segment.description || "",
                eventId: newEvent.id,
                startsAt: args.segment.startsAt,
                durationMillis: BigInt(args.segment.durationMillis),
                isAllDay: args.segment.isAllDay,
            };

            // create the initial segment.
            const segment = await mutationCore.insertImpl(db3.xEventSegment, segmentFields, ctx, tx) as db3.EventSegmentPayloadMinimum;

            // create song lists
            if (args.songList) {
                // create the song list
                const songListFields: Partial<db3.EventSongListPayload> = {
                    eventId: newEvent.id,
                    description: "",
                    event: newEvent,
                    name: "Setlist",
                    sortOrder: 0,
                };
                const songList = await mutationCore.insertImpl(db3.xEventSongList, songListFields, ctx, tx) as db3.EventSongListPayload;
                // add songs.
                for (let i = 0; i < args.songList.length; ++i) {
                    const s = args.songList[i]!;
                    const songFields: Partial<db3.EventSongListSongPayload> = {
                        eventSongListId: songList.id,
                        // TODO: don't resolve each individually. resolve the  whole song list at once and use a map.
                        songId: await resolvePublicId(db3.xSong, s.songId, publicData, tx),
                        sortOrder: i,
                        subtitle: s.comment || "",
                    };
                    await mutationCore.insertImpl(db3.xEventSongListSong, songFields, ctx, tx);
                }
            }

            // create user responses.
            if (args.responses) {
                for (let i = 0; i < args.responses.length; ++i) {
                    const r = args.responses[i]!;
                    //args.responses.forEach(async (r) => {
                    const responseFields: Partial<db3.EventSegmentUserResponsePayload> = {
                        eventSegmentId: segment.id,
                        attendanceId: await resolvePublicId(db3.xEventAttendance, r.attendanceId, publicData, tx),
                        userId: await resolvePublicId(db3.xUser, r.userId, publicData, tx),
                    };
                    await mutationCore.insertImpl(db3.xEventSegmentUserResponse, responseFields, ctx, tx);
                };
            }

            const eventSelection = await db3.xEvent.CalculateSelectionArgs(
                publicData,
                { items: [] },
                false,
                db3.eventEditorView.getSelectionArgs,
            );
            const segmentSelection = await db3.xEventSegment.CalculateSelectionArgs(
                publicData,
                { items: [] },
                false,
                db3.eventSegmentEditorView.getSelectionArgs,
            );
            assert(eventSelection && segmentSelection, "inserted Event views require readable selections");
            const selectedEvent = await tx.event.findUnique({
                where: { id: newEvent.id },
                ...eventSelection,
            });
            const selectedSegment = await tx.eventSegment.findUnique({
                where: { id: segment.id },
                ...segmentSelection,
            });
            assert(selectedEvent && selectedSegment, "inserted Event rows must remain readable");

            return {
                event: db3.eventEditorView.parseDto(authorizeAndProjectDB3ViewModel(
                    db3.xEvent, selectedEvent, publicData, "insertEvent:event")),
                segment: db3.eventSegmentEditorView.parseDto(authorizeAndProjectDB3ViewModel(
                    db3.xEventSegment, selectedSegment, publicData, "insertEvent:segment")),
            };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
    }
);

