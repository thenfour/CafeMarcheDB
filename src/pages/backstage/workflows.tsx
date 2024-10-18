
import { BlitzPage } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { Button } from "@mui/material";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { getUniqueNegativeID } from "shared/utils";
import { MakeNewWorkflowDef, mapWorkflowDef, WorkflowDef, WorkflowDefToMutationArgs } from "shared/workflowEngine";
import { CMStandardDBChip } from "src/core/components/CMChip";
import { simulateLinkClick } from "src/core/components/CMCoreComponents2";
import { CMSingleSelect } from "src/core/components/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { WorkflowEditorForEvent } from "src/core/components/WorkflowEventComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import deleteWorkflowDefMutation from "src/core/db3/mutations/deleteWorkflowDefMutation";
import insertOrUpdateWorkflowDefMutation from "src/core/db3/mutations/insertOrUpdateWorkflowDefMutation";
import { TinsertOrUpdateWorkflowDefArgs } from "src/core/db3/shared/apiTypes";
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
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [mode, setMode] = React.useState<ModeOption>("empty");
    const [value, setValue] = React.useState<WorkflowDef | undefined>(undefined);

    const handleNewWorkflowDef = () => {
        setValue(MakeNewWorkflowDef());
        setMode("new");
    };

    const [saveMutation] = useMutation(insertOrUpdateWorkflowDefMutation);
    const [deleteMutation] = useMutation(deleteWorkflowDefMutation);

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

    const confirm = useConfirm();

    return <div>
        {dashboardContext.isAuthorized(Permission.admin_workflow_defs) && <Button onClick={() => simulateLinkClick("/backstage/editEventCustomFields")}>Edit custom fields</Button>}
        <div>
            <Button onClick={handleNewWorkflowDef} startIcon={gIconMap.Add()}>New workflow</Button>
        </div>
        <div className="WorkflowDefSelect">
            <div>{items.length > 0 ? "Select a workflow to edit" : "There are no workflows to edit; create a new one."}</div>
            {(items.length > 0) && <CMSingleSelect<WorkflowDef>
                getOptions={(args) => items}
                onChange={async (option) => {
                    setValue(option || undefined);
                }}
                getOptionInfo={(item: WorkflowDef) => {
                    return {
                        id: item.id,
                        name: item.name,
                        color: item.color,
                        tooltip: item.description || undefined,
                    };
                }}
                renderOption={(item) => {
                    return item.name;
                    //return <CMStandardDBChip model={item} />;
                }}
                value={value || null}
                nullBehavior={CMSelectNullBehavior.AllowNull}
            />}
        </div>
        {value &&
            <WorkflowEditorForEvent
                onCancel={val => {
                    setValue(undefined);
                }}
                onDelete={async (val) => {
                    try {
                        const confirmed = await confirm({
                            title: "delete item",
                            description: `are you sure you want to delete '${val.name}'?`,
                        });
                        if (confirmed) {
                            setValue(undefined);
                            const result = await deleteMutation({ id: val.id });
                            snackbar.showMessage({ severity: "success", children: "Deleted successfully" });
                        }
                        // console.log(`deleting workflow def...`);
                        // console.log(val);
                        // snackbar.showMessage({ severity: "error", children: "not implemented" });
                    } catch (e) {
                        console.log(e);
                        snackbar.showMessage({ severity: "error", children: "Error occurred; see console." });
                    }
                    client.refetch();
                }}
                initialValue={value}
                onSave={async (val) => {
                    try {
                        const result = await saveMutation(WorkflowDefToMutationArgs(val));
                        snackbar.showMessage({ severity: "success", children: "Saved successfully" });
                    } catch (e) {
                        console.log(e);
                        snackbar.showMessage({ severity: "error", children: "Error occurred; see console." });
                    }
                    client.refetch();
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
