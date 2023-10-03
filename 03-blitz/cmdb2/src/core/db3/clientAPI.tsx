'use client';

import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { CalculateOrderBy, CalculateWhereClause } from "./DB3Client";
import { IsEntirelyIntegral, TAnyModel } from "shared/utils";
import { MutationFunction, useMutation, useQuery } from "@blitzjs/rpc";
import db3queries from "./queries/db3queries";
import updateUserEventSegmentAttendanceMutation from "./mutations/updateUserEventSegmentAttendanceMutation";
import { TupdateEventBasicFieldsArgs, TupdateUserEventSegmentAttendanceMutationArgs, TupdateUserPrimaryInstrumentMutationArgs } from "./shared/apiTypes";
import updateEventBasicFields from "./mutations/updateEventBasicFields";
import updateUserPrimaryInstrumentMutation from "./mutations/updateUserPrimaryInstrumentMutation";
import getPopularEventTags from "src/auth/queries/getPopularEventTags";


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
        });

    };

    updateUserPrimaryInstrument = CreateAPIMutationFunction<TupdateUserPrimaryInstrumentMutationArgs, typeof updateUserPrimaryInstrumentMutation>(updateUserPrimaryInstrumentMutation);
};

const gUsersAPI = new UsersAPI();


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

    usePopularEventTagsQuery = () => {
        return useQuery(getPopularEventTags, {});
    };

    getInstrumentForUserResponse = (response: db3.EventSegmentUserResponsePayload, user: db3.UserPayload): (db3.InstrumentPayload | null) => {
        return db3.getInstrumentForEventSegmentUserResponse(response, user);
    }

    updateUserEventSegmentAttendance = CreateAPIMutationFunction<TupdateUserEventSegmentAttendanceMutationArgs, typeof updateUserEventSegmentAttendanceMutation>(updateUserEventSegmentAttendanceMutation);
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
    users: gUsersAPI,
};
