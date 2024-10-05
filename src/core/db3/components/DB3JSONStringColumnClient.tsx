// specifically for the activity log viewer.
import { GridRenderCellParams } from "@mui/x-data-grid";
import { assert } from "blitz";
import { AttendanceChip, InspectObject, UserChip } from "src/core/components/CMCoreComponents";
import * as db3fields from "../shared/db3basicFields";
import * as DB3ClientCore from "./DB3ClientCore";
import { KeyValueDisplay, NameValuePair } from "src/core/components/CMCoreComponents2";
import { Prisma } from "db";
import * as z from "zod"
import getDistinctChangeFilterValues from "../queries/getDistinctChangeFilterValues";
import { useQuery } from "@blitzjs/rpc";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { gIconMap } from "./IconMap";
import { Tooltip } from "@mui/material";
import { useSnackbar } from "src/core/components/SnackbarContext";

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
};

const ActivityLogChip = (props: React.PropsWithChildren<ActivityLogChipProps>) => {
    return <CMChip
        tooltip={props.children}
        size="small"
        color={props.color}
    >
        <div style={{ textOverflow: "ellipsis", maxWidth: `${props.maxWidthPx || 200}px`, overflow: "hidden", whiteSpace: "nowrap", display: "block" }}>
            {props.children}
        </div>
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
    return <ActivityLogChip>{foundEvent.name}#{foundEvent.id} seg:{foundSegment.name}#{foundSegment.id}</ActivityLogChip>;
};

const ActivityLogEvent = ({ eventId, cacheData }: { eventId: number | null | undefined, cacheData: ActivityLogCacheData }) => {
    const foundEvent = cacheData.events.find(e => e.id === eventId);
    if (!foundEvent) {
        return <ActivityLogChip><Id value={eventId} /></ActivityLogChip>;
    }
    return <ActivityLogChip>{foundEvent.name}#{foundEvent.id}</ActivityLogChip>;
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



type ActivityLogSongList = { id: number, songId: number, sortOrder: number, subtitle: string }[];

const ActivityLogSongListViewer = ({ value, cacheData }: { value: ActivityLogSongList, cacheData: ActivityLogCacheData }) => {
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

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const Toolbar = (props: { value: any }) => {
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
    return <div className="toolbar" style={{ position: "absolute", right: 0, display: "flex", opacity: "15%" }}>
        <Tooltip title={"copy"}><div className="interactable" onClick={handleCopy}>{gIconMap.ContentCopy()}</div></Tooltip>
        <Tooltip title={"dump to console"}><div className="interactable" onClick={handleDump}>{gIconMap.Visibility()}</div></Tooltip>
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const ActivityLogValueViewer = ({ value, cacheData, tableName }: ActivityLogValueViewerProps<any>) => {

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
            default:
                return <span>{JSON.stringify(value, null, 2)}</span>;
        }
    };

    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (JSON.stringify(value) === "{}") return "{}";
    if (typeof value !== "object") {
        return <div className="JSONStringColumnClient viewer">
            <Toolbar value={value} />
            <pre>{JSON.stringify(value, null, 2)}</pre>
        </div>;
    }

    if (tableName.toLowerCase() === "eventsonglist:songs") {
        return <div className="JSONStringColumnClient viewer">
            <Toolbar value={value} />
            <ActivityLogSongListViewer value={value as any} cacheData={cacheData} />
        </div>
    }

    return (
        <div className="JSONStringColumnClient viewer">
            <Toolbar value={value} />
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
            width: 350,
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
                try {
                    asObj = JSON.parse(params.value);
                } catch (e) {
                    asObj = "<parse error>";
                }
                return <ActivityLogValueViewer tableName={(params.row as TRow).table} value={asObj} cacheData={this.cacheData} />;
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








//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const AdminLogPkValue = ({ tableName, pk, cacheData }: { tableName: string, pk: number, cacheData: ActivityLogCacheData }) => {
    switch (tableName.toLowerCase()) {
        case 'event':
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
    }
    return pk;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface AdminLogPkColumnArgs {
    columnName: string;
    cellWidth: number;
    cacheData: ActivityLogCacheData;
};

export class AdminLogPkColumnClient extends DB3ClientCore.IColumnClient {

    cacheData: ActivityLogCacheData;

    constructor(args: AdminLogPkColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            isAutoFocusable: true,
            width: args.cellWidth,
            visible: true,
            className: undefined,
            fieldCaption: undefined,
            fieldDescriptionSettingName: undefined,
        });
        this.cacheData = args.cacheData;
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.GridColProps = {
            type: "string", // we will do our own number conversion
            editable: false,
            renderCell: (params: GridRenderCellParams) => {
                let asObj: any = undefined;
                return <AdminLogPkValue tableName={(params.row as TRow).table} pk={params.value} cacheData={this.cacheData} />;
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={params.value}
        isReadOnly={!this.editable}
        fieldName={this.columnName}
    />;

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => <div>(unsupported render style)</div>;
};

