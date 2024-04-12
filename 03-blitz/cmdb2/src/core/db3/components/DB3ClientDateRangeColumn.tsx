
// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { DateTimeRangeControl } from "src/core/components/DateTimeRangeControl";
import * as db3fields from "../shared/db3basicFields";
import * as DB3ClientCore from "./DB3ClientCore";
import { API } from '../clientAPI';
import * as db3 from "../db3";
import { TAnyModel } from "shared/utils";


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface EventDateRangeColumnArgs {
    fieldCaption?: string;
    fieldDescriptionSettingName?: string;
    startsAtColumnName: string;
    durationMillisColumnName: string;
    isAllDayColumnName: string;
};
export class EventDateRangeColumn extends DB3ClientCore.IColumnClient {
    startsAtSchemaColumn: db3fields.EventStartsAtField;
    durationMillisSchemaColumn: db3fields.GenericIntegerField;
    isAllDaySchemaColumn: db3fields.BoolField;

    args: EventDateRangeColumnArgs;

    constructor(args: EventDateRangeColumnArgs) {
        super({
            columnName: args.startsAtColumnName,
            editable: true,
            headerName: "",
            width: 250,
            visible: true,
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
                return <div>{API.events.getEventSegmentFormattedDateRange(params.row)}</div>;
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                // renders only the editor
                return <DateTimeRangeControl
                    items={[]}
                    onChange={(newValue) => {
                        const spec = newValue.getSpec();
                        params.api.setEditCellValue({ id: params.id, field: this.args.startsAtColumnName, value: spec.startsAtDateTime })!.then(() => {
                            params.api.setEditCellValue({ id: params.id, field: this.args.durationMillisColumnName, value: spec.durationMillis })!.then(() => {
                                params.api.setEditCellValue({ id: params.id, field: this.args.isAllDayColumnName, value: spec.isAllDay })!.then(() => {

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
        value: <div>{API.events.getEventSegmentFormattedDateRange(params.row as any)}</div>
    });

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return this.defaultRenderer({
            value: <DateTimeRangeControl
                items={[]}
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
        // console.log(`ApplyClientToPostClient`);
        // console.log(clientRow);
        // console.log(updateModel);
    };
};




