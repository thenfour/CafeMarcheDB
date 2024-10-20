// specifically for the activity log viewer.
import { useQuery } from "@blitzjs/rpc";
import { DialogContent, Tooltip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";
import { assert } from "blitz";
import { Prisma } from "db";
import React, { cache, Suspense } from "react";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { CMSmallButton, CMTable, NameValuePair } from "src/core/components/CMCoreComponents2";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { Markdown } from "src/core/components/RichTextEditor";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { getURIForEvent } from "../clientAPILL";
import { EventAPI } from "../db3";
import getAdminLogItemInfo from "../queries/getAdminLogItemInfo";
import getDistinctChangeFilterValues from "../queries/getDistinctChangeFilterValues";
import { TinsertOrUpdateEventSongListArgs } from "../shared/apiTypes";
import * as db3fields from "../shared/db3basicFields";
import * as DB3ClientCore from "./DB3ClientCore";
import { gIconMap } from "./IconMap";
import { ReactiveInputDialog } from "src/core/components/CMCoreComponents";
import { formatFileSize } from "shared/rootroot";
import { mapWorkflowDef, MutationArgsToWorkflowDef, TWorkflowMutationResult } from "shared/workflowEngine";
import { WorkflowViewer } from "src/core/components/WorkflowEventComponents";

type ActivityLogCacheData = Awaited<ReturnType<typeof getDistinctChangeFilterValues>>;
//type ActivityLogCacheData = ReturnType<typeof getDistinctChangeFilterValues>;
// type GetDistinctChangeFilterValuesResult = ReturnType<typeof getDistinctChangeFilterValues>;

// type ActivityLogCacheData = GetDistinctChangeFilterValuesResult & {
//     renderUser: (userId: number) => React.ReactNode;
//     renderSong: (songId: number) => React.ReactNode;
//     renderEvent: (eventId: number) => React.ReactNode;
//     renderEventSegment: (eventSegment: number) => React.ReactNode;
// };

interface ActivityLogValueViewerProps<T> {
    value: T;
    tableName: string;
    cacheData: ActivityLogCacheData;

};


/*

{
  "eventSegmentId": 1146,
  "userId": 15,
  "attendanceId": 1
}

*/

interface ActivityLogChipProps {
    maxWidthPx?: number;
    color?: string | null;
    uri?: string | undefined;
};

const ActivityLogChip = (props: React.PropsWithChildren<ActivityLogChipProps>) => {
    const inner = <div style={{ textOverflow: "ellipsis", maxWidth: `${props.maxWidthPx || 200}px`, overflow: "hidden", whiteSpace: "nowrap", display: "block" }}>
        {props.children}
    </div>;
    let linkOrNot: React.ReactNode;
    if (props.uri) {
        linkOrNot = <a href={props.uri} target="_blank" rel="noreferrer">{inner}</a>
    } else {
        linkOrNot = inner;
    }
    return <CMChip
        tooltip={props.children}
        size="small"
        color={props.color}
    >
        {linkOrNot}
    </CMChip>;
};

const Id = ({ value }: { value: number | null | undefined | boolean | string }): React.ReactNode => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (value === true) return "true";
    if (value === false) return "false";
    return <>{value}</>;
};

const ActivityLogUserChip = ({ userId, cacheData }: { userId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const foundUser = cacheData.users.find(u => u.id === userId);
    if (!foundUser) {
        return <ActivityLogChip><Id value={userId} /></ActivityLogChip>;
    }
    return <ActivityLogChip>{foundUser.name} #{userId}</ActivityLogChip>;
};

const ActivityLogEventSegment = ({ eventSegmentId, cacheData }: { eventSegmentId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const foundSegment = cacheData.eventSegments.find(es => es.id === eventSegmentId);
    if (!foundSegment) {
        return <ActivityLogChip>eventSegmentId:<Id value={eventSegmentId} /></ActivityLogChip>;
    }
    const foundEvent = cacheData.events.find(e => e.id === foundSegment.eventId);
    if (!foundEvent) {
        return <ActivityLogChip><Id value={foundSegment.eventId} />, seg:{foundSegment.id}</ActivityLogChip>;
    }
    return <ActivityLogChip uri={getURIForEvent(foundEvent.id)}>{EventAPI.getLabel(foundEvent)}#{foundEvent.id} seg:{foundSegment.name}#{foundSegment.id}</ActivityLogChip>;
};

const ActivityLogEvent = ({ eventId, cacheData }: { eventId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const foundEvent = cacheData.events.find(e => e.id === eventId);
    if (!foundEvent) {
        return <ActivityLogChip><Id value={eventId} /></ActivityLogChip>;
    }

    return <ActivityLogChip uri={getURIForEvent(foundEvent.id)}>{EventAPI.getLabel(foundEvent)}#{foundEvent.id}</ActivityLogChip>;
};

const ActivityLogEventTag = ({ eventTagId, cacheData }: { eventTagId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const foundEventTag = dashboardContext.eventTag.getById(eventTagId);
    if (!foundEventTag) {
        return <ActivityLogChip><Id value={eventTagId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
        color={foundEventTag.color}
    >
        {foundEventTag.text}#{foundEventTag.id}
    </ActivityLogChip>;
};

const ActivityLogEventStatus = ({ eventStatusId, cacheData }: { eventStatusId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const foundEventStatus = dashboardContext.eventStatus.getById(eventStatusId);
    if (!foundEventStatus) {
        return <ActivityLogChip><Id value={eventStatusId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
        color={foundEventStatus.color}
    >
        {foundEventStatus.label}#{foundEventStatus.id}
    </ActivityLogChip>;
};

const ActivityLogEventType = ({ eventTypeId, cacheData }: { eventTypeId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = dashboardContext.eventType.getById(eventTypeId);
    if (!found) {
        return <ActivityLogChip><Id value={eventTypeId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
        color={found.color}
    >
        {found.text}#{found.id}
    </ActivityLogChip>;
};

const ActivityLogAttendance = ({ attendanceId, cacheData }: { attendanceId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = dashboardContext.eventAttendance.getById(attendanceId);
    if (!found) {
        return <ActivityLogChip><Id value={attendanceId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
        color={found.color}
    >
        {found.text}#{found.id}
    </ActivityLogChip>;
};

const ActivityLogPermission = ({ permissionId, cacheData }: { permissionId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = dashboardContext.permission.getById(permissionId);
    if (!found) {
        return <ActivityLogChip><Id value={permissionId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
        color={found.color}
    >
        {found.name}#{found.id}
    </ActivityLogChip>;
};

const ActivityLogRole = ({ roleId, cacheData }: { roleId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = dashboardContext.role.getById(roleId);
    if (!found) {
        return <ActivityLogChip><Id value={roleId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
        color={found.color}
    >
        {found.name}#{found.id}
    </ActivityLogChip>;
};

const ActivityLogUserTag = ({ userTagId, cacheData }: { userTagId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = dashboardContext.userTag.getById(userTagId);
    if (!found) {
        return <ActivityLogChip><Id value={userTagId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
        color={found.color}
    >
        {found.text}#{found.id}
    </ActivityLogChip>;
};

const ActivityLogSong = ({ songId, cacheData }: { songId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = cacheData.songs.find(s => s.id === songId);
    if (!found) {
        return <ActivityLogChip><Id value={songId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
    >
        {found.name}#{found.id}
    </ActivityLogChip>;
};

const ActivityLogSongListEventChip = ({ songListId, cacheData }: { songListId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = cacheData.eventSonglists.find(s => s.id === songListId);
    if (!found) {
        return <ActivityLogChip><Id value={songListId} /></ActivityLogChip>;
    }
    return <ActivityLogEvent eventId={found.eventId} cacheData={cacheData} />
};

const ActivityLogSongTag = ({ songTagId, cacheData }: { songTagId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = dashboardContext.songTag.find(s => s.id === songTagId);
    if (!found) {
        return <ActivityLogChip><Id value={songTagId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
    >
        {found.text}#{found.id}
    </ActivityLogChip>;
};

const ActivityLogInstrument = ({ instrumentId, cacheData }: { instrumentId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    const found = dashboardContext.instrument.find(s => s.id === instrumentId);
    if (!found) {
        return <ActivityLogChip><Id value={instrumentId} /></ActivityLogChip>;
    }
    return <ActivityLogChip
    >
        {found.name}#{found.id}
    </ActivityLogChip>;
};

const ActivityLogFile = ({ file, cacheData }: { file: Prisma.FileGetPayload<{}>, cacheData: ActivityLogCacheData }) => {
    const dashboardContext = useDashboardContext();
    return <ActivityLogChip
    >
        {file.fileLeafName}#{file.id}
    </ActivityLogChip>;
};


type ActivityLogSongListSongPayload = { id?: number | undefined, songId: number, sortOrder: number, subtitle: string, type: "song" };
type ActivityLogSongListDividerPayload = { id?: number | undefined, sortOrder: number, subtitle: string, type: "div" };
type ActivityLogSongListV1 = { id: number, songId: number, sortOrder: number, subtitle: string }[];
type ActivityLogSongListV2 = Partial<TinsertOrUpdateEventSongListArgs> & Pick<TinsertOrUpdateEventSongListArgs, 'songs' | 'dividers'>;

const ActivityLogSongListViewerV2 = ({ value, cacheData }: { value: ActivityLogSongListV2, cacheData: ActivityLogCacheData }) => {
    if (!value.songs) {
        return <ActivityLogKeyValueTable cacheData={cacheData} tableName={"<always treat as keyvalues>"} value={value} />;
    }

    const items: (ActivityLogSongListSongPayload | ActivityLogSongListDividerPayload)[] = [];
    items.push(...value.songs.map(s => {
        const ret: ActivityLogSongListSongPayload = { ...s, type: "song" };
        return ret;
    }));
    items.push(...value.dividers.map(s => {
        const ret: ActivityLogSongListDividerPayload = { ...s, type: "div" };
        return ret;
    }));
    items.sort((a, b) => {
        return a.sortOrder - b.sortOrder;
    });

    const { songs, dividers, ...otherFields } = value;

    return <>
        <ActivityLogKeyValueTable cacheData={cacheData} tableName={"<always treat as keyvalues>"} value={otherFields} />
        <table>
            <thead>
                <tr>
                    <th>
                        id
                    </th>
                    <th>
                        ord
                    </th>
                    <th>
                        song
                    </th>
                    <th>
                        comment
                    </th>
                </tr>
            </thead>
            <tbody>
                {items.map((s, i) => <tr key={i}>
                    <td>{s.id}</td>
                    <td>{s.sortOrder}</td>
                    <td>
                        {s.type === "song" && <ActivityLogSong songId={s.songId} cacheData={cacheData} />}
                        {s.type === "div" && "-----"}
                    </td>
                    <td>{s.subtitle}</td>
                </tr>)}
            </tbody>
        </table>
    </>;
}


const ActivityLogSongListViewerV1 = ({ value, cacheData }: { value: ActivityLogSongListV1, cacheData: ActivityLogCacheData }) => {
    return <table>
        <thead>
            <tr>
                <th>
                    id
                </th>
                <th>
                    ord
                </th>
                <th>
                    song
                </th>
                <th>
                    comment
                </th>
            </tr>
        </thead>
        <tbody>
            {value.map((s, i) => <tr key={i}>
                <td>{s.id}</td>
                <td>{s.sortOrder}</td>
                <td><ActivityLogSong songId={s.songId} cacheData={cacheData} /></td>
                <td>{s.subtitle}</td>
            </tr>)}
        </tbody>
    </table>
}

const ActivityLogSongListViewer = ({ value, cacheData }: { value: ActivityLogSongListV1 | ActivityLogSongListV2, cacheData: ActivityLogCacheData }) => {
    //console.log(`rendering ??`);
    //console.log(value)
    if (Array.isArray(value)) return <ActivityLogSongListViewerV1 value={value} cacheData={cacheData} />;
    return <ActivityLogSongListViewerV2 value={value} cacheData={cacheData} />;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const Toolbar = (props: { value: any, onExpand: () => void }) => {
    const snackbar = useSnackbar();
    const handleCopy = async () => {
        const str = JSON.stringify(props.value, null, 2);
        await navigator.clipboard.writeText(str);
        snackbar.showMessage({ severity: "success", children: `copied ${str.length} chars to the clipboard` });
    };
    const handleDump = () => {
        console.log(props.value);
        snackbar.showMessage({ severity: "success", children: `Done. See console` });
    };
    return <div className="toolbar" style={{ position: "absolute", right: 0, display: "flex" }}>
        <Tooltip title={"copy"}><div className="interactable" onClick={handleCopy}>{gIconMap.ContentCopy()}</div></Tooltip>
        <Tooltip title={"dump to console"}><div className="interactable" onClick={handleDump}>{gIconMap.Terminal()}</div></Tooltip>
        <Tooltip title={"expand"}><div className="interactable" onClick={() => props.onExpand()}>{gIconMap.Launch()}</div></Tooltip>
    </div>;
};


const AdminLogAsyncInfoChip = ({ pk, tableName, cacheData }: { pk: number, tableName: string, cacheData: ActivityLogCacheData }) => {
    const [result] = useQuery(getAdminLogItemInfo, { pk, tableName });
    const nodes: React.ReactNode[] = [];

    if (result.file) {
        const tags: React.ReactNode[] = [];
        if (result.eventIds) {
            tags.push(...result.eventIds.map((eid, i) => <ActivityLogEvent key={i} cacheData={cacheData} eventId={eid} />));
        }
        if (result.userIds) {
            tags.push(...result.userIds.map((uid, i) => <ActivityLogUserChip key={i} cacheData={cacheData} userId={uid} />));
        }
        if (result.instrumentIds) {
            tags.push(...result.instrumentIds.map((iid, i) => <ActivityLogInstrument key={i} cacheData={cacheData} instrumentId={iid} />));
        }
        return <div style={{ border: "1px solid black" }}>
            <strong>file:</strong>
            <ActivityLogFile cacheData={cacheData} file={result.file} />
            <div>
                <strong>tags:</strong>
                {tags}
            </div>
        </div>;
    }

    if (result.eventId) {
        nodes.push(<ActivityLogEvent cacheData={cacheData} eventId={result.eventId} />);
    }
    return nodes;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const AdminLogPkValue = ({ tableName, pk, cacheData }: { tableName: string, pk: number, cacheData: ActivityLogCacheData }) => {
    switch (tableName.toLowerCase()) {
        case 'event':
        case 'event:eventcustomfieldvalue':
            return <ActivityLogEvent cacheData={cacheData} eventId={pk} />;
        case 'song':
            return <ActivityLogSong cacheData={cacheData} songId={pk} />;
        case 'eventtype':
            return <ActivityLogEventType cacheData={cacheData} eventTypeId={pk} />;
        case 'eventtag':
            return <ActivityLogEventTag cacheData={cacheData} eventTagId={pk} />;
        case 'eventstatus':
            return <ActivityLogEventStatus cacheData={cacheData} eventStatusId={pk} />;
        case 'user':
            return <ActivityLogUserChip cacheData={cacheData} userId={pk} />;
        case 'eventsonglist:songs':
        case 'eventsonglist':
            return <ActivityLogSongListEventChip cacheData={cacheData} songListId={pk} />
        case 'eventsegment':
            return <ActivityLogEventSegment cacheData={cacheData} eventSegmentId={pk} />
        case 'eventsegmentuserresponse':
        case 'eventuserresponse':
        case 'file':
            return <Suspense fallback={<div className="lds-dual-ring"></div>}>
                <AdminLogAsyncInfoChip pk={pk} tableName={tableName} cacheData={cacheData} />
            </Suspense>
        //return JSON.stringify <ActivityLogEventSegment cacheData={cacheData} userId={pk} />;

    }
    return pk;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const ActivityLogMarkdownViewerDialog = ({ value, onClose }: { value: string, onClose: () => void }) => {
    return <ReactiveInputDialog onCancel={onClose}>
        <DialogContent>
            <Markdown markdown={value} />
        </DialogContent>
    </ReactiveInputDialog>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const ActivityLogMarkdownValue = ({ value }: { value: string }) => {
    const [open, setOpen] = React.useState<boolean>();
    return <div className="ActivityLogMarkdownValue">
        <Tooltip title={<Markdown markdown={value} />} followCursor>
            <div>
                <CMSmallButton onClick={() => setOpen(true)}>{value}</CMSmallButton>
            </div>
        </Tooltip>
        {open && <ActivityLogMarkdownViewerDialog value={value} onClose={() => setOpen(false)} />}
    </div>;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const ActivityLogKeyValueTable = ({ value, cacheData, tableName }: ActivityLogValueViewerProps<any>) => {
    const IsMarkdownField = (key: string, value: any) => {
        return (typeof (value) === "string") && /comment|description|markdown/i.test(key);
    };

    // Helper function to render value or component based on key
    const renderValue = (key: string, value: any) => {
        switch (key.toLowerCase()) {
            case 'eventid':
                return <ActivityLogEvent eventId={value} cacheData={cacheData} />;
            case 'eventtagid':
                return <ActivityLogEventTag eventTagId={value} cacheData={cacheData} />;
            case 'eventstatusid':
                return <ActivityLogEventStatus eventStatusId={value} cacheData={cacheData} />;
            case 'eventsegmentid':
                return <ActivityLogEventSegment eventSegmentId={value} cacheData={cacheData} />;
            case 'createdbyuserid':
            case 'userid':
                return <ActivityLogUserChip userId={value} cacheData={cacheData} />;
            case 'statusid':
                return <ActivityLogEventStatus eventStatusId={value} cacheData={cacheData} />;
            case 'typeid':
                return <ActivityLogEventType eventTypeId={value} cacheData={cacheData} />;
            case 'attendanceid':
                return <ActivityLogAttendance attendanceId={value} cacheData={cacheData} />;
            case 'visiblepermissionid':
            case 'permissionid':
                return <ActivityLogPermission permissionId={value} cacheData={cacheData} />;
            case 'roleid':
                return <ActivityLogRole roleId={value} cacheData={cacheData} />;
            case 'expectedattendanceusertagid':
            case 'usertagid':
                return <ActivityLogUserTag userTagId={value} cacheData={cacheData} />;
            case 'songid':
                return <ActivityLogSong songId={value} cacheData={cacheData} />;
            case 'instrumentid':
                return <ActivityLogInstrument instrumentId={value} cacheData={cacheData} />;
            case 'tagid':
                {
                    switch (tableName.toLowerCase()) {
                        case 'songtagassociation':
                            return <ActivityLogSongTag songTagId={value} cacheData={cacheData} />;
                        default:
                            return <span>{JSON.stringify(value, null, 2)}</span>;
                    }
                }
        }
        if (IsMarkdownField(key, value)) {
            return <ActivityLogMarkdownValue value={value} />
        }
        return <span>{JSON.stringify(value, null, 2)}</span>;
    };

    if (value === null) return <div className="ActivityLogKeyValueTable">null</div>;
    if (value === undefined) return <div className="ActivityLogKeyValueTable">undefined</div>;

    // a simple scalar value?
    if (typeof value !== "object") {
        return <div className="ActivityLogKeyValueTable">
            {/* <Toolbar value={value} /> */}
            <pre>{JSON.stringify(value, null, 2)}</pre>
        </div>;
    }

    return (
        <div className="ActivityLogKeyValueTable">
            {/* <Toolbar value={value} /> */}
            {Object.entries(value).map(([key, val], index) => (
                // use chip container to make the chips inline
                <CMChipContainer key={index} style={{ flexWrap: "nowrap" }}>
                    {key}: {renderValue(key, val)}
                </CMChipContainer>
            ))}
        </div>
    );


};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const ActivityLogWorkflowDefMutationViewer = ({ value, cacheData }: { value: TWorkflowMutationResult, cacheData: ActivityLogCacheData }) => {
    if (!Array.isArray(value.changes)) {
        return null;
    }
    if (value.changes.length === 0) {
        // width important so the floating toolbar doesn't overlap
        return <div style={{ width: 180 }}>(nothing)</div>
    }
    return <CMTable rows={value.changes} columns={[
        { memberName: "pkid" },
        { memberName: "objectType" },
        { memberName: "action" },
        {
            memberName: "oldValues", render: (args) => {
                const val = args.row.oldValues;
                if (typeof val === "object") {
                    return <ActivityLogKeyValueTable cacheData={cacheData} tableName="--" value={val} />
                }
                return val;
            }
        },
        {
            memberName: "newValues", render: (args) => {
                const val = args.row.newValues;
                if (typeof val === "object") {
                    return <ActivityLogKeyValueTable cacheData={cacheData} tableName="--" value={val} />
                }
                return val;
            }
        },
    ]} />
};

const ActivityLogWorkflowDefMutationGraphPopup = ({ value, cacheData, onClose }: { value: TWorkflowMutationResult, cacheData: ActivityLogCacheData, onClose: () => void }) => {
    if (!value.serializableFlowDef) {
        return null;
    }
    const workflowDef = MutationArgsToWorkflowDef(value.serializableFlowDef);
    return <ReactiveInputDialog onCancel={onClose} className="activityLogWorkflowGraphDialog">
        <WorkflowViewer value={workflowDef} />
    </ReactiveInputDialog>;
};

const ActivityLogWorkflowDefMutationRootViewer = ({ value, cacheData }: { value: TWorkflowMutationResult, cacheData: ActivityLogCacheData }) => {
    const [changesOpen, setChangesOpen] = React.useState<boolean>(false);
    const [graphOpen, setGraphOpen] = React.useState<boolean>(false);

    return <>
        <Toolbar value={value} onExpand={() => setChangesOpen(true)} />
        <CMSmallButton onClick={() => setGraphOpen(true)}>Open graph</CMSmallButton>
        <ActivityLogWorkflowDefMutationViewer value={value} cacheData={cacheData} />
        {changesOpen && <ReactiveInputDialog onCancel={() => setChangesOpen(false)}>
            <DialogContent>
                <ActivityLogWorkflowDefMutationViewer value={value} cacheData={cacheData} />
            </DialogContent>
        </ReactiveInputDialog>}
        {graphOpen && <ActivityLogWorkflowDefMutationGraphPopup value={value} cacheData={cacheData} onClose={() => setGraphOpen(false)} />}
    </>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const ActivityLogValueViewer = ({ value, cacheData, tableName }: ActivityLogValueViewerProps<any>) => {
    const [open, setOpen] = React.useState<boolean>();

    if (value === null) return <div className="JSONStringColumnClient viewer">null</div>;
    if (value === undefined) return <div className="JSONStringColumnClient viewer">undefined</div>;

    if (typeof value !== "object") {
        return <div className="JSONStringColumnClient viewer">
            <Toolbar value={value} onExpand={() => setOpen(true)} />
            <pre>{JSON.stringify(value, null, 2)}</pre>
            {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
                <DialogContent>
                    <div className="pre">{JSON.stringify(value, null, 2)}</div>
                </DialogContent>
            </ReactiveInputDialog>}
        </div>;
    }

    if (tableName.toLowerCase() === "eventsonglist:songs" || tableName.toLowerCase() === "eventsonglist") {
        return <div className="JSONStringColumnClient viewer">
            <Toolbar value={value} onExpand={() => setOpen(true)} />
            <ActivityLogSongListViewer value={value as any} cacheData={cacheData} />
            {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
                <DialogContent>
                    <ActivityLogSongListViewer value={value as any} cacheData={cacheData} />
                </DialogContent>
            </ReactiveInputDialog>}
        </div>
    }

    if (tableName.toLowerCase() === "workflowdef") {
        return <div className="JSONStringColumnClient viewer">
            <ActivityLogWorkflowDefMutationRootViewer value={value as any} cacheData={cacheData} />
        </div>
    }

    return <div className="JSONStringColumnClient viewer">
        <Toolbar value={value} onExpand={() => setOpen(true)} />
        <ActivityLogKeyValueTable cacheData={cacheData} tableName={tableName} value={value} />
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            <DialogContent>
                <ActivityLogKeyValueTable cacheData={cacheData} tableName={tableName} value={value} />
            </DialogContent>
        </ReactiveInputDialog>}
    </div>;
};




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface JSONStringColumnClientArgs {
    columnName: string;
    cacheData: ActivityLogCacheData;
};

type TRow = Prisma.ChangeGetPayload<{}>;

export class JSONStringColumnClient extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: db3fields.GenericStringField;
    cacheData: ActivityLogCacheData;

    constructor(args: JSONStringColumnClientArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: 400,
            visible: true,
            className: undefined,
            isAutoFocusable: true,
            fieldCaption: undefined,
            fieldDescriptionSettingName: undefined,
        });
        this.cacheData = args.cacheData;
    }

    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.GenericStringField;

        assert(this.typedSchemaColumn.format === "raw", `JSONStringColumnClient[${tableClient.tableSpec.args.table.tableID}.${this.schemaColumn.member}] has an unsupported type.`);

        this.GridColProps = {
            type: "string",
            editable: false,
            renderCell: (params: GridRenderCellParams) => {
                let asObj: any = undefined;
                const row = params.row as Prisma.ChangeGetPayload<{}>;
                try {
                    asObj = JSON.parse(params.value);
                } catch (e) {
                    asObj = "<parse error>";
                }
                return <div className="adminLogJSONValue">
                    <div className="size">{formatFileSize((params.value as string).length)}</div>
                    <AdminLogPkValue cacheData={this.cacheData} pk={row.recordId} tableName={row.table} />
                    <ActivityLogValueViewer tableName={(params.row as TRow).table} value={asObj} cacheData={this.cacheData} />
                </div>;
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={params.value}
        fieldName={this.columnName}
        isReadOnly={false}
    />;

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => <div>(unsupported render style)</div>;
};

