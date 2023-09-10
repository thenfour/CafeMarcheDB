'use client';

import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import * as db3 from "src/core/db3/db3";
import { CalculateOrderBy, CalculateWhereClause } from "./DB3Client";
import { TAnyModel } from "shared/utils";
import { MutationFunction, useMutation, useQuery } from "@blitzjs/rpc";
import db3queries from "./queries/db3queries";
import db3eventMutations from "./mutations/updateUserEventSegmentAttendanceMutation";
import updateUserEventSegmentAttendanceMutation from "./mutations/updateUserEventSegmentAttendanceMutation";
import { TupdateUserEventSegmentAttendanceCommentMutationArgs, TupdateUserEventSegmentAttendanceMutationArgs, UpdateUserEventSegmentAttendanceMutationArgs } from "./shared/apiTypes";
import updateUserEventSegmentAttendanceCommentMutation from "./mutations/updateUserEventSegmentAttendanceCommentMutation";


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
    mutateFn: (inp: TData) => Promise<TData>;
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



export class EventsAPI {

    useGetTable<TClientPayload>(args: APIQueryArgs, tableSchema: db3.xTable): APIQueryResult<TClientPayload> {
        const where = CalculateWhereClause(tableSchema, args.filterModel, args.tableParams);
        const orderBy = CalculateOrderBy(args.sortModel);

        const queryInput: db3.QueryInput = {
            tableName: tableSchema.tableName,
            orderBy,
            where,
        };

        const [dbItems, { refetch }] = useQuery(db3queries, queryInput);

        const clientItems = dbItems.map(dbitem => {
            return tableSchema.getClientModel(dbitem as TAnyModel, "view");
            // todo: enrich with any more stuff?
        });

        return {
            items: clientItems,
            refetch,
        };
    }

    useGetEvents(args: APIQueryArgs) {
        return this.useGetTable<db3.EventPayloadClient>(args, db3.xEvent);
    }

    useGetEventAttendanceOptions(args: APIQueryArgs) {
        return this.useGetTable<db3.EventAttendancePayload>(args, db3.xEventAttendance);
    }

    getEventSegmentFormattedDateRange(segment: db3.EventSegmentPayloadFromEvent) {
        return "daterangehere";
    }

    getEventInfoForUser(args: { event: db3.EventPayloadClient, user: db3.UserPayload }) {
        const i = new db3.EventInfoForUser({ event: args.event, user: args.user });
        return i;
    }

    updateUserEventSegmentAttendance = CreateAPIMutationFunction<TupdateUserEventSegmentAttendanceMutationArgs, typeof updateUserEventSegmentAttendanceMutation>(updateUserEventSegmentAttendanceMutation);
    updateUserEventSegmentAttendanceComment = CreateAPIMutationFunction<TupdateUserEventSegmentAttendanceCommentMutationArgs, typeof updateUserEventSegmentAttendanceCommentMutation>(updateUserEventSegmentAttendanceCommentMutation);
};


export const API = {
    events: new EventsAPI(),
};
