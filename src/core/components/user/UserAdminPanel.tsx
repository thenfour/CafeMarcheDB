import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { EditFieldsDialogButton } from "../EditFieldsDialog";
import { useSnackbar } from "../SnackbarContext";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import { ImpersonateUserButton } from "./ImpersonateUserButton";
import { useDashboardContext } from "../DashboardContext";
import { Permission } from "@/shared/permissions";

interface UserAdminPanelProps {
    user: db3.EnrichedVerboseUser;
    tableClient: DB3Client.xTableRenderClient;
    refetch?: () => void;
    readonly: boolean;
};

export const UserAdminPanel = (props: UserAdminPanelProps) => {
    const snackbar = useSnackbar();
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

