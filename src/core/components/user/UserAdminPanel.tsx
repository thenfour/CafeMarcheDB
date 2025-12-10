import { Permission } from "@/shared/permissions";
import { Routes } from "@blitzjs/next";
import { Button, Tooltip } from "@mui/material";
import { useRouter } from "next/router";
import * as DB3Client from "src/core/db3/DB3Client";
import { gIconMap } from "../../db3/components/IconMap";
import { useConfirm } from "../ConfirmationDialog";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { EditFieldsDialogButton } from "../EditFieldsDialog";
import { useSnackbar } from "../SnackbarContext";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import { ImpersonateUserButton } from "./ImpersonateUserButton";
import { EnrichedVerboseUser } from "./UserListItem";

interface UserAdminPanelProps {
    user: EnrichedVerboseUser;
    tableClient: DB3Client.xTableRenderClient;
    refetch?: () => void;
    readonly: boolean;
};

export const UserAdminPanel = (props: UserAdminPanelProps) => {
    const snackbar = useSnackbar();
    const router = useRouter();
    const confirm = useConfirm();
    const dashboardContext = useDashboardContext();

    if (!dashboardContext.isAuthorized(Permission.admin_users)) {
        return null;
    }

    return (
        <div style={{}}>
            <AdminResetPasswordButton
                user={props.user}
            />
            <ImpersonateUserButton userId={props.user.id} />
            <Tooltip title="Delete this user (soft).">
                <Button onClick={async () => {
                    if (await confirm({
                        description: `Are you sure you want to (soft) delete user ${props.user.name}, id ${props.user.id}?`,
                        title: "Delete User",
                    })) {
                        await snackbar.invokeAsync(async () => {
                            await props.tableClient.doDeleteMutation(props.user.id, "softWhenPossible");
                            void router.push(Routes.UserSearchPage());
                        });
                    }

                }} startIcon={gIconMap.Delete()}>Delete</Button>
            </Tooltip>
            <EditFieldsDialogButton
                readonly={props.readonly}
                dialogTitle="Edit User Fields"
                tableSpec={props.tableClient.tableSpec}
                initialValue={props.user}
                onCancel={() => { }}
                onOK={async (updatedUser, tableClient, api) => {
                    await snackbar.invokeAsync(async () => {
                        await props.tableClient.doUpdateMutation(updatedUser);
                        if (props.refetch) {
                            props.refetch();
                        }
                        api.close();
                    });
                }}
                dialogDescription={""}
                renderButtonChildren={() => "Edit User Fields"}
            />
        </div>
    );
}

