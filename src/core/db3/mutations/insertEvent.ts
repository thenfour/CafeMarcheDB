import { cmauthorize, type CMAuthCtxWithUser } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import { assert } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { authorizeAndProjectDB3ViewModel, resolvePublicForeignIds, resolvePublicId } from "../server/db3PublicIds";
import { TinsertEventArgs } from "../shared/apiTypes";
import { findAttendanceMember } from "../server/eventAttendancePolicy";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    cmauthorize(Permission.login),
    async (args: TinsertEventArgs, ctx: CMAuthCtxWithUser) => {

        return db.$transaction(async tx => {
            const auth = ctx.auth;
            const resolvedEventFields = await resolvePublicForeignIds(
                db3.xEvent,
                args.event,
                auth,
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
            const newEvent = await mutationCore.insertImpl(db3.xEvent, eventFields, ctx.auth, tx) as Prisma.EventGetPayload<{}>;

            const segmentFields: Omit<Prisma.EventSegmentUncheckedCreateInput, "publicId"> = {
                name: args.segment.name || "Set 1",
                description: args.segment.description || "",
                eventId: newEvent.id,
                startsAt: args.segment.startsAt,
                durationMillis: BigInt(args.segment.durationMillis),
                isAllDay: args.segment.isAllDay,
            };

            // create the initial segment.
            const segment = await mutationCore.insertImpl(db3.xEventSegment, segmentFields, ctx.auth, tx) as db3.EventSegmentPayloadMinimum;

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
                const songList = await mutationCore.insertImpl(db3.xEventSongList, songListFields, ctx.auth, tx) as db3.EventSongListPayload;
                // add songs.
                for (let i = 0; i < args.songList.length; ++i) {
                    const s = args.songList[i]!;
                    const songFields: Partial<db3.EventSongListSongPayload> = {
                        eventSongListId: songList.id,
                        // TODO: don't resolve each individually. resolve the  whole song list at once and use a map.
                        songId: await resolvePublicId(db3.xSong, s.songId, auth, tx),
                        sortOrder: i,
                        subtitle: s.comment || "",
                    };
                    await mutationCore.insertImpl(db3.xEventSongListSong, songFields, ctx.auth, tx);
                }
            }

            // create user responses.
            if (args.responses) {
                for (let i = 0; i < args.responses.length; ++i) {
                    const r = args.responses[i]!;
                    // lsmb todo: this may not be optimal; should batch create.
                    const member = await findAttendanceMember(tx, auth.requireBand().id, r.userId);
                    assert(member, "An imported response requires an active membership in the selected band.");
                    //args.responses.forEach(async (r) => {
                    const responseFields: Partial<db3.EventSegmentUserResponsePayload> = {
                        eventSegmentId: segment.id,
                        attendanceId: await resolvePublicId(db3.xEventAttendance, r.attendanceId, auth, tx),
                        bandUserId: member.id,
                    };
                    await mutationCore.insertImpl(db3.xEventSegmentUserResponse, responseFields, ctx.auth, tx);
                };
            }

            const eventSelection = await db3.xEvent.CalculateSelectionArgs(
                auth,
                { items: [] },
                false,
                db3.eventEditorView.getSelectionArgs,
            );
            const segmentSelection = await db3.xEventSegment.CalculateSelectionArgs(
                auth,
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
                    db3.xEvent, selectedEvent, auth, "insertEvent:event")),
                segment: db3.eventSegmentEditorView.parseDto(authorizeAndProjectDB3ViewModel(
                    db3.xEventSegment, selectedSegment, auth, "insertEvent:segment")),
            };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
    }
);

