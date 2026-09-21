import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import {
    Button,
    Tooltip
} from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { Permission } from "shared/permissions";
import setUserSysAdmin from "src/auth/mutations/setUserSysAdmin";
import { CMUserMgmtButton } from "../CMCoreComponents2";
import { useConfirm } from "../ConfirmationDialog";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { useSnackbar } from "../SnackbarContext";
import { ImpersonateUserButton } from "./ImpersonateUserButton";
import { MergeUsersButton } from "./MergeUsersButton";
import { EnrichedVerboseUser } from "./UserListItem";
import { useUserLifecycleActions } from "./useUserLifecycleActions";


type UserMgmtCaps = {
    canMerge?: boolean;
    canManageSignInMethods: boolean;
    canCorrectEmail: boolean;
    canDeactivate: boolean;
    canReactivate: boolean;
    canSetSysAdmin: boolean;
    canResetPassword: boolean;
    canImpersonate: boolean;

    deactivationContinuityWarnings: string[];
}

interface UserAdminPanelProps {
    user: EnrichedVerboseUser;
    refetch?: () => void;
    capabilities: UserMgmtCaps;
}

export type DeactivateUserButtonProps = {
    capabilities: UserMgmtCaps;
    user: EnrichedVerboseUser;
    onOK?: () => void;
};

export const DeactivateUserButton = ({ capabilities, user, onOK }: DeactivateUserButtonProps) => {
    const snackbar = useSnackbar();
    const lifecycle = useUserLifecycleActions();
    const dashboardContext = useDashboardContext();
    const router = useRouter();
    const [pending, setPending] = React.useState(false);

    return <>
        {capabilities.canDeactivate && <Tooltip title="Deactivate this account and revoke its sessions.">
            <CMUserMgmtButton
                enabled={!pending}
                onClick={async () => {
                    setPending(true);
                    try {
                        const changed = await lifecycle.deactivate(user, capabilities.deactivationContinuityWarnings);
                        if (!changed) return;
                        snackbar.showSuccess("User deactivated");
                        if (dashboardContext.currentUser?.id === user.id) {
                            window.location.assign("/backstage");
                        } else if (!dashboardContext.isAuthorized(Permission.recover_users)) {
                            await router.replace(dashboardContext.isAuthorized(Permission.search_users)
                                ? Routes.UserSearchPage() : "/backstage");
                        } else {
                            await onOK?.();
                        }
                    } catch (error) {
                        console.error(error);
                        snackbar.showError("Unable to deactivate user; see console");
                    } finally {
                        setPending(false);
                    }
                }}
            >
                Deactivate
            </CMUserMgmtButton>
        </Tooltip>}
    </>;
};

export const ReactivateUserButton = ({ capabilities, user, onOK }: DeactivateUserButtonProps) => {
    const lifecycle = useUserLifecycleActions();
    const snackbar = useSnackbar();
    const [pending, setPending] = React.useState(false);
    return capabilities.canReactivate ? <Button disabled={pending} onClick={async () => {
        setPending(true);
        try {
            if (!await lifecycle.reactivate(user)) return;
            await onOK?.();
            snackbar.showSuccess("User reactivated");
        } catch (error) {
            console.error(error);
            snackbar.showError("Unable to reactivate user; see console");
        } finally {
            setPending(false);
        }
    }}>Reactivate</Button> : null;
};

type SetUserSysadminButtonProps = {
    capabilities: UserMgmtCaps;
    user: EnrichedVerboseUser;
    onOK?: () => void;
};

export const SetUserSysadminButton = ({ capabilities, user, onOK }: SetUserSysadminButtonProps) => {
    const [setUserSysAdminMutation] = useMutation(setUserSysAdmin);
    const snackbar = useSnackbar();
    const confirm = useConfirm();
    return <>
        {capabilities.canSetSysAdmin && (
            <CMUserMgmtButton
                onClick={async () => {
                    const isSysAdmin = !user.isSysAdmin;
                    if (!await confirm({
                        title: isSysAdmin ? "Grant Sysadmin" : "Revoke Sysadmin",
                        description: `${isSysAdmin ? "Grant" : "Revoke"} Sysadmin status for ${user.name}?`,
                    })) return;
                    await snackbar.invokeAsync(async () => {
                        await setUserSysAdminMutation({ userId: user.id, isSysAdmin });
                        void onOK?.();
                    }, "Sysadmin status updated");
                }}
            >
                {user.isSysAdmin ? "Revoke Sysadmin" : "Grant Sysadmin"}
            </CMUserMgmtButton>)}
    </>;

};

export const UserAdminPanel = (props: UserAdminPanelProps) => {
    const { capabilities } = props;
    const hasAnyControl = Object.entries(capabilities)
        .some(([key, value]) => key.startsWith("can") && value === true);
    if (!hasAnyControl) return null;

    return <>
        {capabilities.canMerge && <MergeUsersButton user={props.user} />}

        <DeactivateUserButton
            capabilities={capabilities}
            user={props.user}
            onOK={() => {
                return props.refetch?.();
            }}
        />

        <ReactivateUserButton capabilities={capabilities} user={props.user} onOK={props.refetch} />

        <SetUserSysadminButton
            capabilities={capabilities}
            user={props.user}
            onOK={() => {
                props.refetch?.();
            }}
        />

        {capabilities.canImpersonate && <ImpersonateUserButton userId={props.user.id} />}

    </>;
};
