'use client';

import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { TAnyModel, gQueryOptions } from "shared/utils";
import { MutationFunction, useMutation, useQuery } from "@blitzjs/rpc";
import updateUserEventSegmentAttendanceMutation from "./mutations/updateUserEventSegmentAttendanceMutation";
import { TGeneralDeleteArgs, TdeleteEventCommentArgs, TinsertEventArgs, TinsertEventCommentArgs, TinsertOrUpdateEventSongListArgs, TupdateEventBasicFieldsArgs, TupdateEventCommentArgs, TupdateUserEventSegmentAttendanceMutationArgs, TupdateUserPrimaryInstrumentMutationArgs } from "./shared/apiTypes";
import updateEventBasicFields from "./mutations/updateEventBasicFields";
import updateUserPrimaryInstrumentMutation from "./mutations/updateUserPrimaryInstrumentMutation";
import getPopularEventTags from "src/auth/queries/getPopularEventTags";
import insertEventComment from "./mutations/insertEventComment";
import updateEventComment from "./mutations/updateEventComment";
import deleteEventComment from "./mutations/deleteEventComment";
import insertEventSongListMutation from "./mutations/insertEventSongListMutation";
import deleteEventSongList from "./mutations/deleteEventSongList";
import updateEventSongListMutation from "./mutations/updateEventSongListMutation";
import { Permission } from "shared/permissions";
import { Prisma } from "db";
import insertEvent from "./mutations/insertEvent";


export interface APIQueryArgs {
    filterModel?: GridFilterModel,
    tableParams?: TAnyModel,
    sortModel?: GridSortModel,
};

export interface APIQueryResult<TClientPayload> {
    items: TClientPayload[],
    refetch: () => void,
};

interface APIMutationToken<TData> {
    mutateFn: (inp: TData) => Promise<TData>; // black box
    invoke: (args: TData) => Promise<TData>; // for clients to invoke the mutation (alias of APIMutationFunction.invoke)
};

class APIMutationFunction<TData, TMutation extends MutationFunction<TData>> {
    mutation: TMutation;

    constructor(mutation: TMutation) {
        this.mutation = mutation;
    }

    useToken() {
        const [mutateFn] = useMutation(this.mutation);
        const ret: APIMutationToken<TData> = {
            mutateFn,
            invoke: async (args: TData) => {
                return await mutateFn(args);
            }
        };
        return ret;
    }

    async invoke(token: APIMutationToken<TData>, args: TData): Promise<TData> {
        return await token.mutateFn(args);
    }
};

// helps deduce types
function CreateAPIMutationFunction<TData, TMutation extends MutationFunction<TData>>(mutation: TMutation) {
    return new APIMutationFunction<TData, TMutation>(mutation);
}

export interface EventMinMaxAttendeesResult {
    minAttendees: number | null;
    maxAttendees: number | null;
}

export interface SongListStats {
    songCount: number;
    durationSeconds: number;
    songsOfUnknownDuration: number; // true if the duration excludes songs which have unknown duration
    // credits?
    // tags?
};

class FilesAPI {
    getURIForFile = (file: Prisma.FileGetPayload<{}>) => {
        return `/api/files/download/${file.storedLeafName}`;
    }
};

const gFilesAPI = new FilesAPI();

class UsersAPI {
    // returns an instrument payload, or null if the user has no instruments.
    // primary instrument is defined as either teh 1st instrument marked as primary, or if none are primary, the 1st instrument period.
    getPrimaryInstrument = (user: db3.UserPayload): (db3.InstrumentPayload | null) => {
        if (user.instruments.length < 1) return null;
        const p = user.instruments.find(i => i.isPrimary);
        if (p) {
            return p.instrument;
        }
        return user.instruments[0]!.instrument;
    };

    getAllPermissions = () => {
        return DB3Client.useTableRenderContext({
            tableSpec: new DB3Client.xTableClientSpec({
                table: db3.xPermission,
                columns: [
                    new DB3Client.PKColumnClient({ columnName: "id" }),
                ],
            }),
            requestedCaps: DB3Client.xTableClientCaps.Query,
            clientIntention: { intention: 'user', mode: 'primary' },
        });

    };

    getPermission = (q: Permission) => {
        return (this.getAllPermissions().items as Prisma.PermissionGetPayload<{}>[]).find(p => p.name === q);
    };

    getPublicPermission = () => {
        return this.getPermission(Permission.visibility_all)!;
    };

    getVisibilityInfo = <T extends { visiblePermission: db3.PermissionPayloadMinimum | null },>(item: T) => {
        const isPrivate = item.visiblePermission === null;
        const isPublic = item.visiblePermission?.name === Permission.visibility_all;
        const cssClasses: string[] = [];
        if (isPrivate) cssClasses.push("visibility-private");
        if (isPublic) cssClasses.push("visibility-public");
        if (!isPrivate) cssClasses.push(`visiblePermission-${item.visiblePermission!.name}`);

        return {
            isPrivate,
            isPublic,
            className: cssClasses.join(" "),
        }
    }

    updateUserPrimaryInstrument = CreateAPIMutationFunction<TupdateUserPrimaryInstrumentMutationArgs, typeof updateUserPrimaryInstrumentMutation>(updateUserPrimaryInstrumentMutation);
};

const gUsersAPI = new UsersAPI();


class EventsAPI {

    getEventSegmentFormattedDateRange(segment: db3.EventSegmentPayloadFromEvent) {
        return "daterangehere";
    }

    getEventSegmentDateInfo(segment: db3.EventSegmentPayloadFromEvent) {
        return db3.getDateRangeInfo({
            startsAt: segment.startsAt,
            endsAt: segment.endsAt,
        });
    }

    getEventInfoForUser(args: { event: db3.EventPayloadClient, user: db3.UserPayload }) {
        const i = new db3.EventInfoForUser({ event: args.event, user: args.user });
        return i;
    }

    getURIForEvent(eventOrEventIdOrSlug: number | string | db3.EventPayloadMinimum, tabSlug?: string) {
        const tabPart = tabSlug ? `/${tabSlug}` : "";

        if (typeof eventOrEventIdOrSlug === 'object') {
            if (eventOrEventIdOrSlug.slug) {
                return `/backstage/event/${eventOrEventIdOrSlug.slug}${tabPart}`;
            }
        }
        return `/backstage/event/${eventOrEventIdOrSlug}${tabPart}`;
    }

    getMinMaxAttendees({ event }: { event: db3.EventClientPayload_Verbose }) {
        const ret: EventMinMaxAttendeesResult = {
            minAttendees: null,
            maxAttendees: null,
        };
        event.segments.forEach(seg => {
            // count attendees for this segment who are going
            const att = seg.responses.filter(resp => resp.attendance && (resp.attendance.strength > 50)).length;
            if (ret.minAttendees === null || att < ret.minAttendees) ret.minAttendees = att;
            if (ret.maxAttendees === null || att > ret.maxAttendees) ret.maxAttendees = att;
        });
        return ret;
    }

    // returns an array, one element per segment, containing # of people attending.
    getAttendeeCountPerSegment({ event }: { event: db3.EventClientPayload_Verbose }) {
        return event.segments.map(seg => ({
            segment: seg,
            attendeeCount: seg.responses.filter(resp => resp.attendance && (resp.attendance.strength > 50)).length
        }));
    }

    getEventTypesClient() {
        return DB3Client.useTableRenderContext({
            tableSpec: new DB3Client.xTableClientSpec({
                table: db3.xEventType,
                columns: [
                    new DB3Client.PKColumnClient({ columnName: "id" }),
                ],
            }),
            requestedCaps: DB3Client.xTableClientCaps.Query,
            clientIntention: { intention: 'user', mode: 'primary' },
        });
    }

    getEventStatusesClient() {
        return DB3Client.useTableRenderContext({
            tableSpec: new DB3Client.xTableClientSpec({
                table: db3.xEventStatus,
                columns: [
                    new DB3Client.PKColumnClient({ columnName: "id" }),
                ],
            }),
            requestedCaps: DB3Client.xTableClientCaps.Query,
            clientIntention: { intention: 'user', mode: 'primary' },
        });
    }

    usePopularEventTagsQuery = () => {
        return useQuery(getPopularEventTags, {}, gQueryOptions.default);
    };

    getInstrumentForUserResponse = (response: db3.EventSegmentUserResponsePayload, user: db3.UserPayload): (db3.InstrumentPayload | null) => {
        return db3.getInstrumentForEventSegmentUserResponse(response, user);
    }

    getSongListStats = (songList: db3.EventSongListPayload): SongListStats => {
        console.assert(songList.songs);
        const initialValue: SongListStats = {
            durationSeconds: 0,
            songsOfUnknownDuration: 0,
            songCount: 0,
        };
        // filter out "new" items which have no song specified yet.
        return songList.songs.filter(s => !!s.songId).reduce((acc, song) => {
            console.assert(!!song.song); // make sure the payload contains
            const ret = acc;
            if (song.song.lengthSeconds == null) {
                ret.songsOfUnknownDuration++;
            } else {
                ret.durationSeconds += song.song.lengthSeconds;
            }
            ret.songCount++;
            return ret;
        }, initialValue);
    };

    newEventMutation = CreateAPIMutationFunction<TinsertEventArgs, typeof insertEvent>(insertEvent);

    updateUserEventSegmentAttendance = CreateAPIMutationFunction<TupdateUserEventSegmentAttendanceMutationArgs, typeof updateUserEventSegmentAttendanceMutation>(updateUserEventSegmentAttendanceMutation);
    updateEventBasicFields = CreateAPIMutationFunction<TupdateEventBasicFieldsArgs, typeof updateEventBasicFields>(updateEventBasicFields);

    insertEventCommentMutation = CreateAPIMutationFunction<TinsertEventCommentArgs, typeof insertEventComment>(insertEventComment);
    deleteEventCommentMutation = CreateAPIMutationFunction<TdeleteEventCommentArgs, typeof deleteEventComment>(deleteEventComment);
    updateEventCommentMutation = CreateAPIMutationFunction<TupdateEventCommentArgs, typeof updateEventComment>(updateEventComment);

    // lol consistent naming
    insertEventSongListx = CreateAPIMutationFunction<TinsertOrUpdateEventSongListArgs, typeof insertEventSongListMutation>(insertEventSongListMutation);
    deleteEventSongListx = CreateAPIMutationFunction<TGeneralDeleteArgs, typeof deleteEventSongList>(deleteEventSongList);
    updateEventSongListx = CreateAPIMutationFunction<TinsertOrUpdateEventSongListArgs, typeof updateEventSongListMutation>(updateEventSongListMutation);
};

class SongsAPI {

    getURIForSong(songOrIdOrSlug: number | string | db3.SongPayloadMinimum) {
        if (typeof songOrIdOrSlug === 'object') {
            if (songOrIdOrSlug.slug) {
                return `/backstage/song/${songOrIdOrSlug.slug}`;
            }
        }
        return `/backstage/song/${songOrIdOrSlug}`;
    }

    getFormattedBPM(song: db3.SongPayloadMinimum) {
        if (!song.startBPM) {
            if (!song.endBPM) {
                return "";// neither specified
            }
            return `⇢${song.endBPM}`; // only end bpm
        }
        if (!song.endBPM) {
            return `${song.startBPM}⇢`; // only start bpm
        }
        // both specified 
        if ((song.startBPM | 0) === (song.endBPM | 0)) {
            return `${song.startBPM}`; // both BPMs the same: just show 1.
        }
        return `${song.startBPM}⇢${song.endBPM}`; // only start bpm
    }

};

export const API = {
    events: new EventsAPI(),
    songs: new SongsAPI(),
    users: gUsersAPI,
    files: gFilesAPI,
};
