import { useMutation } from "@blitzjs/rpc";
import {
    Tooltip
} from "@mui/material";
import { useRouter } from "next/router";
import { portalHref } from "src/route/portalRouting";
import React from "react";
import { Permission } from "shared/permissions";
import setUserSysAdmin from "src/auth/mutations/setUserSysAdmin";
import { CMButton, CMUserMgmtButton } from "../CMCoreComponents2";
import { useConfirm } from "../ConfirmationDialog";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { useSnackbar } from "../SnackbarContext";
import { ImpersonateUserButton } from "./ImpersonateUserButton";
import type { UserClientPayload } from "src/core/db3/shared/schema/prismArgs";
import { useUserLifecycleActions } from "./useUserLifecycleActions";
import { MergeUsersButton } from "./MergeUsersButton";


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
    user: UserClientPayload;
    refetch?: () => Promise<unknown> | void;
    capabilities: UserMgmtCaps;
    onDeactivated?: () => Promise<unknown> | void;
}

export type DeactivateUserButtonProps = {
    capabilities: UserMgmtCaps;
    user: UserClientPayload;
    onOK?: () => Promise<unknown> | void;
};

export const DeactivateUserButton = ({ capabilities, user, onOK }: DeactivateUserButtonProps) => {
    const snackbar = useSnackbar();
    const lifecycle = useUserLifecycleActions();
    const dashboardContext = useDashboardContext();
    const router = useRouter();
    const [pending, setPending] = React.useState(false);
    const inFlight = React.useRef(false);

    return <>
        {capabilities.canDeactivate && <Tooltip title="Deactivate this account and revoke its sessions.">
            <CMUserMgmtButton
                enabled={!pending}
                onClick={async () => {
                    if (inFlight.current) {
                        return;
                    }
                    inFlight.current = true;
                    setPending(true);
                    try {
                        const changed = await lifecycle.deactivate(user, capabilities.deactivationContinuityWarnings);
                        if (!changed) {
                            return;
                        }
                        snackbar.showSuccess("User deactivated");
                        if (dashboardContext.currentUser?.publicId === user.publicId) {
                            window.location.assign(portalHref("/backstage", dashboardContext.memberPresentation, dashboardContext.portalHosting));
                        } else if (!dashboardContext.isAuthorized(Permission.manage_global_users)) {
                            await router.replace(portalHref(dashboardContext.isAuthorized(Permission.search_users)
                                ? "/backstage/users" : "/backstage", dashboardContext.memberPresentation, dashboardContext.portalHosting));
                        } else {
                            await onOK?.();
                        }
                    } catch (error) {
                        console.error(error);
                        snackbar.showError("Unable to deactivate user; see console");
                    } finally {
                        inFlight.current = false;
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
    const inFlight = React.useRef(false);
    return capabilities.canReactivate ? <CMButton disabled={pending} onClick={async () => {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setPending(true);
        try {
            if (!await lifecycle.reactivate(user)) {
                return;
            }
            await onOK?.();
            snackbar.showSuccess("User reactivated");
        } catch (error) {
            console.error(error);
            snackbar.showError("Unable to reactivate user; see console");
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }}>Reactivate</CMButton> : null;
};

type SetUserSysadminButtonProps = {
    capabilities: UserMgmtCaps;
    user: UserClientPayload;
    onOK?: () => Promise<unknown> | void;
};

export const SetUserSysadminButton = ({ capabilities, user, onOK }: SetUserSysadminButtonProps) => {
    const [setUserSysAdminMutation] = useMutation(setUserSysAdmin);
    const snackbar = useSnackbar();
    const confirm = useConfirm();
    const [pending, setPending] = React.useState(false);
    const inFlight = React.useRef(false);
    return <>
        {capabilities.canSetSysAdmin && (
            <CMUserMgmtButton
                enabled={!pending}
                onClick={async () => {
                    if (inFlight.current) {
                        return;
                    }
                    inFlight.current = true;
                    setPending(true);
                    try {
                        const isSysAdmin = !user.isSysAdmin;
                        if (!await confirm({
                            title: isSysAdmin ? "Grant Sysadmin" : "Revoke Sysadmin",
                            description: `${isSysAdmin ? "Grant" : "Revoke"} Sysadmin status for ${user.name}?`,
                        })) {
                            return;
                        }
                        await snackbar.invokeAsync(async () => {
                            await setUserSysAdminMutation({ userId: user.publicId, isSysAdmin });
                            await onOK?.();
                        }, "Sysadmin status updated");
                    } finally {
                        inFlight.current = false;
                        setPending(false);
                    }
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
    if (!hasAnyControl) {
        return null;
    }

    return <>

        <DeactivateUserButton
            capabilities={capabilities}
            user={props.user}
            onOK={() => {
                return props.onDeactivated ? props.onDeactivated() : props.refetch?.();
            }}
        />

        <ReactivateUserButton capabilities={capabilities} user={props.user} onOK={props.refetch} />

        <SetUserSysadminButton
            capabilities={capabilities}
            user={props.user}
            onOK={() => {
                return props.refetch?.();
            }}
        />

        {capabilities.canImpersonate && <ImpersonateUserButton userId={props.user.publicId} />}
        {capabilities.canMerge && <MergeUsersButton user={props.user} />}

    </>;
};
