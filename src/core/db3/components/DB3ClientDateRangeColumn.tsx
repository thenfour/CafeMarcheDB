
// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import type { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { DateTimeRangeControl } from "src/core/components/DateTime/DateTimeRangeControl";
import * as db3fields from "../shared/db3basicFields";
import * as DB3ClientCore from "./DB3ClientCore";
//import { API } from '../clientAPI';
import * as db3 from "../db3";
import type { TAnyModel } from "../shared/apiTypes";
import type { SettingKey } from "shared/settingKeys";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface EventDateRangeColumnArgs {
    headerName: string;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    startsAtColumnName: string;
    durationMillisColumnName: string;
    isAllDayColumnName: string;
    className?: string;
};
export class EventDateRangeColumn extends DB3ClientCore.IColumnClient {
    startsAtSchemaColumn: db3fields.EventStartsAtField;
    durationMillisSchemaColumn: db3fields.GenericIntegerField;
    isAllDaySchemaColumn: db3fields.BoolField;

    args: EventDateRangeColumnArgs;

    constructor(args: EventDateRangeColumnArgs) {
        super({
            columnName: args.startsAtColumnName,
            isAutoFocusable: false,
            editable: true,
            headerName: args.headerName,
            width: 250,
            visible: true,
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
        });
        this.args = args;
    }

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.startsAtSchemaColumn = this.schemaColumn as db3fields.EventStartsAtField;
        this.durationMillisSchemaColumn = tableClient.schema.getColumn(this.args.durationMillisColumnName) as db3fields.GenericIntegerField;
        this.isAllDaySchemaColumn = tableClient.schema.getColumn(this.args.isAllDayColumnName) as db3fields.BoolField;

        this.GridColProps = {
            type: "custom",
            renderCell: (params: GridRenderCellParams) => {
                // renders only the value (because the grid header shows the name)
                return <div>{db3.getEventSegmentDateTimeRange(params.row).toString()}</div>;
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                // renders only the editor
                return <DateTimeRangeControl
                    onChange={(newValue) => {
                        const spec = newValue.getSpec();
                        void params.api.setEditCellValue({ id: params.id, field: this.args.startsAtColumnName, value: spec.startsAtDateTime })!.then(() => {
                            void params.api.setEditCellValue({ id: params.id, field: this.args.durationMillisColumnName, value: spec.durationMillis })!.then(() => {
                                void params.api.setEditCellValue({ id: params.id, field: this.args.isAllDayColumnName, value: spec.isAllDay })!.then(() => {

                                });
                            });
                        });
                    }}
                    value={db3.getEventSegmentDateTimeRange(params.row as db3.EventSegmentPayload)}
                />;
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<unknown>) => this.defaultRenderer({
        className: params.className,
        isReadOnly: true,
        validationResult: undefined,
        value: <div>{db3.getEventSegmentDateTimeRange(params.row as any).toString()}</div>,
    });

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return this.defaultRenderer({
            isReadOnly: !this.editable,
            validationResult: params.validationResult,
            value: <DateTimeRangeControl
                onChange={(newValue) => {
                    const spec = newValue.getSpec();
                    params.api.setFieldValues({
                        [this.args.startsAtColumnName]: spec.startsAtDateTime,
                        [this.args.durationMillisColumnName]: spec.durationMillis,
                        [this.args.isAllDayColumnName]: spec.isAllDay,
                    });
                }}
                value={db3.getEventSegmentDateTimeRange(params.row as db3.EventSegmentPayload)}
            />
        });
    };

    ApplyClientToPostClient = (clientRow: TAnyModel, updateModel: TAnyModel, mode: db3.DB3RowMode) => {
        updateModel[this.args.startsAtColumnName] = clientRow[this.args.startsAtColumnName];
        updateModel[this.args.durationMillisColumnName] = clientRow[this.args.durationMillisColumnName];
        updateModel[this.args.isAllDayColumnName] = clientRow[this.args.isAllDayColumnName];
    };
};




