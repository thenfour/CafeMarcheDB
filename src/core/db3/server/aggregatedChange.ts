// import { AuthenticatedCtx, Ctx, assert } from "blitz";
// import db, { Prisma } from "db";
// import * as mime from 'mime';
// import * as mm from 'music-metadata';
// import { nanoid } from 'nanoid';
// import { ComputeChangePlan } from "shared/associationUtils";
// import { Permission } from "shared/permissions";
// import { DateTimeRange } from "shared/time";
// import { ChangeAction, ChangeContext, CreateChangeContext, ObjectDiff, RegisterChange, getIntersectingFields, sanitize } from "shared/utils";
// import sharp from "sharp";
// import * as db3 from "../db3";
// import { CMDBTableFilterModel, FileCustomData, ForkImageParams, ImageFileFormat, ImageMetadata, TAnyModel, TinsertOrUpdateEventSongListArgs, TinsertOrUpdateEventSongListDivider, TinsertOrUpdateEventSongListSong, TupdateEventCustomFieldValue, TupdateEventCustomFieldValuesArgs, WorkflowObjectType, getFileCustomData } from "../shared/apiTypes";
// import { SharedAPI } from "../shared/sharedAPI";
// import { EventForCal, EventForCalArgs, GetEventCalendarInput } from "./icalUtils";
// import { TWorkflowChange } from "shared/workflowEngine";

// export enum AggregatedChangeType {
//     EventSongList = "EventSongList",
//     WikiPageRevision = "WikiPageRevision",
// };

// // this is used for the NEWVALUES
// // pk and userid not necessary.
// export interface AggregatedChange<T extends {}> {
//     payloadType: "aggregatedChange", // detect this payload
//     changeType: AggregatedChangeType,
//     firstChangedAt: Date,
//     lastChangedAt: Date,
//     changeCount: number,
//     oldValues: T, //
//     newValues: T,
// };

// type AggregatedChangeContext<T> = {
// };

// export function BeginAggregatedChange<T extends {}>(): AggregatedChangeContext<T> {
//     // find existing aggregated change
// }

// export function CommitAggregatedChange() {
//     //
// }

// ok so. ...
// #331, #320, #323 are about aggregating activity log data.
// but it's either a shitty solution or a complex one.
// considering how unimportant the activity log is, let's look at the "correct" solution:
// the correct solution is to change the activity log table to support aggregation (adding columns like changeCount, firstChangedAt, lastChangedAt)
// and then adding change providers. do not add them to xTable, because they are not per table, they're per "function" like changing song list songs, etc.
// that means making fundamental changes to a lot of core mutations to wrap around with begin/end aggregated change logic, plus adapt the activity log viewer.
// overall it's a doable and nice effort but not worth it at the moment...
