// workflow client code specific to CMDB events

import { WorkflowDef } from "db";
import { WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import { MakeAlwaysBinding, WFFieldBinding } from "./WorkflowUserComponents";

// name: new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150, fieldCaption: "Event name", className: "titleText" }),
// dateRange: new DB3Client.EventDateRangeColumn({ startsAtColumnName: "startsAt", headerName: "Date range", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay" }),
// description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
// locationDescription: new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 150, fieldCaption: "Location" }),
// type: new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 150, selectStyle: "inline", fieldCaption: "Event Type" }),
// status: new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 150, fieldCaption: "Status" }),
// expectedAttendanceUserTag: new DB3Client.ForeignSingleFieldClient<db3.UserTagPayload>({ columnName: "expectedAttendanceUserTag", cellWidth: 150, fieldCaption: "Who's invited?" }),
// tags: new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false, fieldCaption: "Tags" }),

// frontpageVisible: new DB3Client.BoolColumnClient({ columnName: "frontpageVisible" }),
// frontpageDate: new DB3Client.GenericStringColumnClient({ columnName: "frontpageDate", cellWidth: 150 }),
// frontpageTime: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTime", cellWidth: 150 }),
// frontpageDetails: new DB3Client.MarkdownStringColumnClient({ columnName: "frontpageDetails", cellWidth: 150 }),

// frontpageTitle: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTitle", cellWidth: 150 }),
// frontpageLocation: new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocation", cellWidth: 150 }),
// frontpageLocationURI: new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocationURI", cellWidth: 150 }),
// frontpageTags: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTags", cellWidth: 150 }),

// hmm. for the workflow,
// we'll need bindings for tags and foreignsingles
// and date?
// 

// basically replicate an event? wouldn't it be even better to just use an existing event? yes. allow the user to select.
// for creating a new one, xEvent.createnew
// export type MockEvent = {

// };

// const MakeEmptyMockEvent = (): MockEvent => ({
//     boolQuestions: [null, null, null],
//     textQuestions: [null, null, null],
//     intQuestions: [null, null, null],
//     floatQuestions: [null, null, null],
//     colorQuestions: [null, null, null],
// });

export function getMockEventBinding(args: {
    model: MockEvent,
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    setModel?: (newModel: MockEvent) => void,
    setOperand2?: (newOperand: unknown) => void,
}): WFFieldBinding<unknown> {
    const [name, indexStr] = (args.nodeDef.fieldName || ":").split(":");
    const index = parseInt(indexStr!);
    switch (name) {
        case "bool":
            return MakeBoolBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel.boolQuestions[index] = val;
                    args.setModel && args.setModel(newModel);
                },
                setOperand2: args.setOperand2,
                value: valueOr(args.model.boolQuestions[index], null, null),
            });
        case "text":
            return MakeTextBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel.textQuestions[index] = val;
                    args.setModel && args.setModel(newModel);
                },
                setOperand2: args.setOperand2,
                value: args.model.textQuestions[index] || "",
            });
        default:
            // be flexible to this when field names are changing or you select "field value" but haven't selected a field yet so it will be undefined, etc.
            return MakeAlwaysBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                value: false,
            });
        //throw new Error(`unknown field name ${args.nodeDef.fieldName}`);
    }
};
