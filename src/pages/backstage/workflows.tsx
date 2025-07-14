
import { BlitzPage } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { Alert, Button } from "@mui/material";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { MakeNewWorkflowDef, mapWorkflowDef, WorkflowDef, WorkflowDefToMutationArgs } from "shared/workflowEngine";
import { CMSingleSelect } from "src/core/components/select/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/select/CMSingleSelectDialog";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { WorkflowEditorForEvent } from "src/core/components/workflow/WorkflowEventComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import deleteWorkflowDefMutation from "src/core/db3/mutations/deleteWorkflowDefMutation";
import insertOrUpdateWorkflowDefMutation from "src/core/db3/mutations/insertOrUpdateWorkflowDefMutation";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";

type ModeOption = "empty" | "new" | "edit";

const WorkflowDefEditorMain = () => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [mode, setMode] = React.useState<ModeOption>("empty");
    const [value, setValue] = React.useState<WorkflowDef | undefined>(undefined);

    // when you save, the db will populate a bunch of new IDs etc. for simplicity, reload the object. during that period,
    // show spinner, and upon refetch, select the item with the given ID.
    const [loadNewValueWithId, setLoadNewValueId] = React.useState<number | undefined>(undefined);

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

    React.useEffect(() => {
        if (loadNewValueWithId) {
            const item = items.find(i => i.id === loadNewValueWithId);
            if (item) {
                setValue(item);
            }
        }
    }, [client.remainingQueryStatus.dataUpdatedAt]);

    return <div>
        {dashboardContext.isAuthorized(Permission.admin_workflow_defs) && <a href={"/backstage/editEventCustomFields"} target="_blank" rel="noreferrer">Edit custom fields</a>}
        <div>
            <Button onClick={handleNewWorkflowDef} startIcon={gIconMap.Add()}>New workflow</Button>
            {(items.reduce((acc, i) => i.isDefaultForEvents ? (acc + 1) : acc, 0) > 1) && <Alert severity="error">more than one workflow is marked as default. no.</Alert>}
        </div>
        <div className="WorkflowDefSelect">
            <div>{items.length > 0 ? "Select a workflow to edit" : "There are no workflows to edit; create a new one."}</div>
            {(items.length > 0) && <CMSingleSelect<WorkflowDef>
                getOptions={(args) => items}
                chipSize="big"
                onChange={async (option) => {
                    setValue(option || undefined);
                }}
                getOptionInfo={(item: WorkflowDef) => {
                    return {
                        id: item.id,
                        name: `${item.name} #${item.id} ${item.isDefaultForEvents ? "(🟢Default)" : ""}`,
                        color: item.color,
                        tooltip: item.description || undefined,
                    };
                }}
                renderOption={(item) => {
                    return `${item.name} #${item.id} ${item.isDefaultForEvents ? "(🟢Default)" : ""}`;
                }}
                value={value || null}
                nullBehavior={CMSelectNullBehavior.AllowNull}
            />}
        </div>
        {value &&
            <WorkflowEditorForEvent
                onCancel={async (val) => {
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
                    } catch (e) {
                        console.log(e);
                        snackbar.showMessage({ severity: "error", children: "Error occurred; see console." });
                    }
                    client.refetch();
                }}
                initialValue={value}
                readonly={!canEdit}
                onSave={async (val) => {
                    try {
                        const result = await saveMutation(WorkflowDefToMutationArgs(val));
                        setValue(undefined);
                        setLoadNewValueId(result.serializableFlowDef!.id);
                        // now we need to actually re-query for this object and select it because by serializing, you have changed IDs etc.
                        snackbar.showMessage({ severity: "success", children: "Saved successfully" });
                    } catch (e) {
                        console.log(e);
                        snackbar.showMessage({ severity: "error", children: "Error occurred; see console." });
                    }
                    client.refetch();
                }} />}
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
