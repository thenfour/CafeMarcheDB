
import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { MakeNewWorkflowDef, WorkflowDef } from "shared/workflowEngine";
import { CMStandardDBChip } from "src/core/components/CMChip";
import { simulateLinkClick } from "src/core/components/CMCoreComponents2";
import { CMSingleSelect } from "src/core/components/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { WorkflowEditorForEvent } from "src/core/components/WorkflowEventComponents";
import { mapWorkflowDef } from "src/core/components/WorkflowUserComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";


interface WorkflowDefEditorProps {
    value: WorkflowDef;
};
const WorkflowDefEditor = (props: WorkflowDefEditorProps) => {
    return <div>workflow def deitor dhere</div>;
};

// interface ManageWorkflowDefItemProps {
//     item: db3.WorkflowDef_SearchPayload;
//     onClick: () => void;
// };

// const ManageWorkflowDefItem = (props: ManageWorkflowDefItemProps) => {
//     return <div className="interactable" onClick={props.onClick}>{props.item.name}</div>
// };

// interface WorkflowDefListProps {
//     selectedValue: 
// };

// const WorkflowDefList = (props: WorkflowDefListProps) => {
//     const dashboardContext = useDashboardContext();

//     const client = DB3Client.useTableRenderContext({
//         requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
//         clientIntention: dashboardContext.userClientIntention,
//         tableSpec: new DB3Client.xTableClientSpec({
//             table: db3.xWorkflowDef_Search,
//             columns: [
//                 new DB3Client.PKColumnClient({ columnName: "id" }),
//                 new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 250, fieldCaption: "Name" }),
//                 new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 250 }),
//                 new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 120 }),
//                 new DB3Client.BoolColumnClient({ columnName: "isDefaultForEvents", fieldCaption: "Is default workflow for events?" }),
//             ],
//         }),
//     });
//     const items = client.items as db3.WorkflowDef_SearchPayload[];

//     const canEdit = dashboardContext.isAuthorized(Permission.edit_workflow_defs);

//     return <div>
//         <div className='EventDashboard'>
//             {items.map(i => <ManageWorkflowDefItem key={i.id} item={i} onClick={() => {
//                 //
//             }} />)}
//         </div>
//     </div>;
// };

type ModeOption = "empty" | "new" | "edit";

const WorkflowDefEditorMain = () => {
    const dctx = useDashboardContext();
    const snackbar = useSnackbar();
    const [mode, setMode] = React.useState<ModeOption>("empty");
    const [value, setValue] = React.useState<WorkflowDef | undefined>(undefined);

    const handleNewWorkflowDef = () => {
        setValue(MakeNewWorkflowDef());
        setMode("new");
    };

    const dashboardContext = useDashboardContext();

    const client = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        clientIntention: dashboardContext.userClientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xWorkflowDef_Verbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 250, fieldCaption: "Name" }),
                new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 250 }),
                new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 120 }),
                new DB3Client.BoolColumnClient({ columnName: "isDefaultForEvents", fieldCaption: "Is default workflow for events?" }),
            ],
        }),
    });
    const items = (client.items as db3.WorkflowDef_Verbose[]).map(x => mapWorkflowDef(x));

    const canEdit = dashboardContext.isAuthorized(Permission.edit_workflow_defs);

    return <div>
        {dctx.isAuthorized(Permission.admin_workflow_defs) && <Button onClick={() => simulateLinkClick("/backstage/editEventCustomFields")}>Edit custom fields</Button>}
        <div>
            <Button onClick={handleNewWorkflowDef} startIcon={gIconMap.Add()}>New workflow</Button>
        </div>
        <div className="WorkflowDefSelect">
            <div>{items.length > 0 ? "Select a workflow to edit" : "There are no workflows to edit; create a new one."}</div>
            {(items.length > 0) && <CMSingleSelect<WorkflowDef>

                getOptions={(args) => items}
                onChange={(option) => {
                    console.error(`todo: onchange`);
                }}
                getOptionInfo={(item: WorkflowDef) => {
                    return {
                        id: item.id,
                        color: item.color,
                        tooltip: item.description || undefined,
                    };
                }}
                renderOption={(item) => {
                    return <CMStandardDBChip model={item} />;
                }}
                value={null}
                nullBehavior={CMSelectNullBehavior.AllowNull}
            />}
        </div>
        {value &&
            <WorkflowEditorForEvent
                onDelete={(val) => {
                    try {
                        console.log(`deleting workflow def...`);
                        console.log(val);
                        snackbar.showMessage({ severity: "error", children: "not implemented" });
                    } catch (e) {
                        console.log(e);
                        snackbar.showMessage({ severity: "error", children: "Error occurred; see console." });
                    }
                }}
                initialValue={value}
                onSave={async (val) => {
                    try {
                        console.log(`saving workflow def...`);
                        console.log(val);
                        snackbar.showMessage({ severity: "error", children: "not implemented" });
                    } catch (e) {
                        console.log(e);
                        snackbar.showMessage({ severity: "error", children: "Error occurred; see console." });
                    }
                }} />}
        {/* {value && mode === "new" &&
            <WorkflowEditorForEvent initialValue={value} onSave={(val) => {
                try {
                    console.log(`saving new workflow def...`);
                    console.log(val);
                    // once you successfully save a new workflow, then you're editing it.
                    setMode("edit");
                    snackbar.showMessage({ severity: "error", children: "not implemented" });
                } catch (e) {
                    console.log(e);
                    snackbar.showMessage({ severity: "error", children: "Error occurred; see console." });
                }
            }} />} */}
    </div>;
};

const WorkflowConfigPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Workflow mgmt" basePermission={Permission.view_workflow_defs}>
            <React.Suspense>
                <WorkflowDefEditorMain />
            </React.Suspense>
        </DashboardLayout>
    );
};

export default WorkflowConfigPage;
