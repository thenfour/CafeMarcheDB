'use client';

import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { CalculateOrderBy, CalculateWhereClause } from "./DB3Client";
import { IsEntirelyIntegral, TAnyModel } from "shared/utils";
import { MutationFunction, useMutation, useQuery } from "@blitzjs/rpc";
import db3queries from "./queries/db3queries";
import updateUserEventSegmentAttendanceMutation from "./mutations/updateUserEventSegmentAttendanceMutation";
import { TupdateEventBasicFieldsArgs, TupdateUserEventSegmentAttendanceCommentMutationArgs, TupdateUserEventSegmentAttendanceMutationArgs } from "./shared/apiTypes";
import updateUserEventSegmentAttendanceCommentMutation from "./mutations/updateUserEventSegmentAttendanceCommentMutation";
import updateEventBasicFields from "./mutations/updateEventBasicFields";


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

class EventsAPI {

    getEventSegmentFormattedDateRange(segment: db3.EventSegmentPayloadFromEvent) {
        return "daterangehere";
    }

    getEventInfoForUser(args: { event: db3.EventPayloadClient, user: db3.UserPayload }) {
        const i = new db3.EventInfoForUser({ event: args.event, user: args.user });
        return i;
    }

    getURIForEvent(eventOrEventIdOrSlug: number | string | db3.EventPayloadMinimum) {
        if (typeof eventOrEventIdOrSlug === 'object') {
            if (eventOrEventIdOrSlug.slug) {
                return `/backstage/event/${eventOrEventIdOrSlug.slug}`;
            }
        }
        return `/backstage/event/${eventOrEventIdOrSlug}`;
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
        });
    }

    updateUserEventSegmentAttendance = CreateAPIMutationFunction<TupdateUserEventSegmentAttendanceMutationArgs, typeof updateUserEventSegmentAttendanceMutation>(updateUserEventSegmentAttendanceMutation);
    updateUserEventSegmentAttendanceComment = CreateAPIMutationFunction<TupdateUserEventSegmentAttendanceCommentMutationArgs, typeof updateUserEventSegmentAttendanceCommentMutation>(updateUserEventSegmentAttendanceCommentMutation);
    updateEventBasicFields = CreateAPIMutationFunction<TupdateEventBasicFieldsArgs, typeof updateEventBasicFields>(updateEventBasicFields);
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

};

export const API = {
    events: new EventsAPI(),
    songs: new SongsAPI(),
};
