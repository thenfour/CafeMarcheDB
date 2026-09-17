import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import {
    Button,
    DialogContent,
    DialogTitle,
    TextField,
    Tooltip
} from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { Permission } from "shared/permissions";
import correctUserEmail from "src/auth/mutations/correctUserEmail";
import setUserSysAdmin from "src/auth/mutations/setUserSysAdmin";
import * as DB3Client from "src/core/db3/DB3Client";
import { DialogActionsCM } from "../CMCoreComponents2";
import { useConfirm } from "../ConfirmationDialog";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { EditFieldsDialogButton } from "../EditFieldsDialog";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { useSnackbar } from "../SnackbarContext";
import { ImpersonateUserButton } from "./ImpersonateUserButton";
import { MergeUsersButton } from "./MergeUsersButton";
import { EnrichedVerboseUser } from "./UserListItem";
import { UserSignInMethodsButton } from "./UserSignInMethodsButton";
import { useUserLifecycleActions } from "./useUserLifecycleActions";

type UserMgmtCaps = {
    canMerge?: boolean;
    canManageSignInMethods: boolean;
    canEdit: boolean;
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
    tableClient: DB3Client.xTableRenderClient;
    refetch?: () => void;
    readonly: boolean;
    capabilities: UserMgmtCaps;
}

type EditUserProfileButtonProps = {
    capabilities: UserMgmtCaps;
    readonly: boolean;
    tableClient: DB3Client.xTableRenderClient;
    user: EnrichedVerboseUser;
    onOK: () => void;
};

export const EditUserProfileButton = ({ capabilities, readonly, tableClient, user, onOK }: EditUserProfileButtonProps) => {
    const snackbar = useSnackbar();

    return <>{capabilities.canEdit && <EditFieldsDialogButton
        readonly={readonly}
        dialogTitle="Edit user profile"
        tableSpec={tableClient.tableSpec}
        initialValue={user}
        onCancel={() => { }}
        onOK={async (updatedUser, tableClient, api) => {
            await snackbar.invokeAsync(async () => {
                await tableClient.doUpdateMutation(updatedUser);
                onOK();
                api.close();
            });
        }}
        dialogDescription={null}
        renderButtonChildren={() => "Edit profile"}
    />}</>
}

type CorrectUserEmailButtonProps = {
    capabilities: UserMgmtCaps;
    user: EnrichedVerboseUser;
    onOK?: () => void;
};

export const CorrectUserEmailButton = ({ capabilities, user, onOK }: CorrectUserEmailButtonProps) => {
    const snackbar = useSnackbar();
    const [correctUserEmailMutation] = useMutation(correctUserEmail);
    const [showEmailDialog, setShowEmailDialog] = React.useState(false);
    const [correctedEmail, setCorrectedEmail] = React.useState(user.email);

    return <>
        {capabilities.canCorrectEmail && <>
            <Button onClick={() => {
                setCorrectedEmail(user.email);
                setShowEmailDialog(true);
            }}>
                Change contact email
            </Button>
            <ResponsiveDialog open={showEmailDialog} onClose={() => setShowEmailDialog(false)}>
                <DialogTitle>Change contact email for {user.name}</DialogTitle>
                <DialogContent dividers>
                    <p>
                        This changes the profile&apos;s contact address. Manage login identifiers separately under Sign-in methods.
                    </p>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Contact email"
                        margin="normal"
                        onChange={event => setCorrectedEmail(event.target.value)}
                        type="email"
                        value={correctedEmail}
                    />
                    <DialogActionsCM>
                        <Button onClick={() => setShowEmailDialog(false)}>Cancel</Button>
                        <Button disabled={!correctedEmail.trim()} onClick={async () => {
                            await snackbar.invokeAsync(async () => {
                                await correctUserEmailMutation({
                                    userId: user.id,
                                    email: correctedEmail,
                                });
                                setShowEmailDialog(false);
                                onOK?.();
                            }, "Contact email corrected");
                        }}>Save</Button>
                    </DialogActionsCM>
                </DialogContent>
            </ResponsiveDialog>
        </>}
    </>
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
            <Button disabled={pending} onClick={async () => {
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
            }}>Deactivate</Button>
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
        {capabilities.canSetSysAdmin && <Button onClick={async () => {
            const isSysAdmin = !user.isSysAdmin;
            if (!await confirm({
                title: isSysAdmin ? "Grant Sysadmin" : "Revoke Sysadmin",
                description: `${isSysAdmin ? "Grant" : "Revoke"} Sysadmin status for ${user.name}?`,
            })) return;
            await snackbar.invokeAsync(async () => {
                await setUserSysAdminMutation({ userId: user.id, isSysAdmin });
                void onOK?.();
            }, "Sysadmin status updated");
        }}>{user.isSysAdmin ? "Revoke Sysadmin" : "Grant Sysadmin"}</Button>}
    </>;

};

export const UserAdminPanel = (props: UserAdminPanelProps) => {
    const { capabilities } = props;
    const hasAnyControl = Object.entries(capabilities)
        .some(([key, value]) => key.startsWith("can") && value === true);
    if (!hasAnyControl) return null;

    return <div>
        {capabilities.canMerge && <MergeUsersButton user={props.user} />}
        {capabilities.canManageSignInMethods && <UserSignInMethodsButton user={props.user} onChanged={props.refetch} />}
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

    </div>;
};
