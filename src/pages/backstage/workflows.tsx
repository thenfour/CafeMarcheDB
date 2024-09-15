
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery } from "@mui/material";
import impersonateUser from "src/auth/mutations/impersonateUser";
import { useMutation } from "@blitzjs/rpc";
import { useRouter } from "next/router";
import { Routes } from "@blitzjs/next"
import * as React from 'react';
import forgotPassword from "src/auth/mutations/forgotPassword";
import { useTheme } from "@mui/material/styles";
import { simulateLinkClick } from "src/core/components/CMCoreComponents2";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { gIconMap } from "src/core/db3/components/IconMap";

interface ManageWorkflowDefItemProps {
    item: db3.WorkflowDef_SearchPayload;
    client: DB3Client.xTableRenderClient;
    readonly: boolean;
};

const ManageWorkflowDefItem = (props: ManageWorkflowDefItemProps) => {
    return <div>worflow</div>
};

const ManageWorkflowDefList = () => {
    const dashboardContext = useDashboardContext();
    //const { showMessage: showSnackbar } = useSnackbar();

    // const getItemInfo = (option: { value: string, label: string }): DB3Client.ConstEnumStringFieldClientItemInfo => {
    //     if (option.value === gNullValue) return {};
    //     return {
    //         color: gRedirectTypeColorMap[option.value],
    //         descriptionMarkdownSettingKey: `CustomLinkRedirectTypeDescriptionMarkdown_${option.value}`,
    //     };
    // };

    //const q = DB3Client.useDb3Query(db3.xWorkflowDef_Search);

    const client = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        clientIntention: dashboardContext.userClientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xWorkflowDef_Search,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 250, fieldCaption: "Name" }),
                new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 250 }),
                new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 120 }),
                new DB3Client.BoolColumnClient({ columnName: "isDefaultForEvents", fieldCaption: "Is default workflow for events?" }),
            ],
        }),
    });
    const items = client.items as db3.WorkflowDef_SearchPayload[];

    const canEdit = dashboardContext.isAuthorized(Permission.edit_workflow_defs);

    return <div>
        <div className='EventDashboard'>
            {items.map(i => <ManageWorkflowDefItem key={i.id} item={i} client={client} readonly={!canEdit} />)}
        </div>
    </div>;
};

const WorkflowDefEditorMain = () => {
    const dctx = useDashboardContext();

    const handleNewWorkflowDef = () => {

    };

    return <div>
        {dctx.isAuthorized(Permission.admin_workflow_defs) && <div><a href="/backstage/editEventCustomFields">edit custom fields</a></div>}
        <ManageWorkflowDefList />
        <Button onClick={handleNewWorkflowDef} startIcon={gIconMap.Add()}>New workflow</Button>
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
