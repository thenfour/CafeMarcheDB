import { kContinuityAcknowledgementErrorPrefix } from "@/src/auth/server/userManagementPolicy";
import { useMutation, useQuery } from "@blitzjs/rpc";
import {
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    TextField,
    Tooltip,
} from "@mui/material";
import React from "react";
import correctUserEmail from "src/auth/mutations/correctUserEmail";
import deactivateUser from "src/auth/mutations/deactivateUser";
import setUserSysAdmin from "src/auth/mutations/setUserSysAdmin";
import getUserManagementCapabilities from "src/auth/queries/getUserManagementCapabilities";
import * as DB3Client from "src/core/db3/DB3Client";
import { gIconMap } from "../../db3/components/IconMap";
import { DialogActionsCM } from "../CMCoreComponents2";
import { useConfirm } from "../ConfirmationDialog";
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
}

const getContinuityPermissionsFromError = (error: unknown): string[] => {
    const message = error instanceof Error ? error.message : String(error);
    const markerIndex = message.indexOf(kContinuityAcknowledgementErrorPrefix);
    if (markerIndex < 0) return [];
    return message
        .slice(markerIndex + kContinuityAcknowledgementErrorPrefix.length)
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
};

type UserMgmtCaps = {
    canEdit: boolean;
    canCorrectEmail: boolean;
    canDeactivate: boolean;
    canSetSysAdmin: boolean;

    deactivationContinuityWarnings: string[];
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
                Correct login email
            </Button>
            <Dialog open={showEmailDialog} onClose={() => setShowEmailDialog(false)}>
                <DialogTitle>Correct login email for {user.name}</DialogTitle>
                <DialogContent dividers>
                    <p>
                        This changes the account&apos;s login identifier and revokes its active sessions.
                        It does not change any linked Google identity.
                    </p>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Login email"
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
                            }, "Login email corrected");
                        }}>Save</Button>
                    </DialogActionsCM>
                </DialogContent>
            </Dialog>
        </>}
    </>
}

export type DeactivateUserButtonProps = {
    capabilities: UserMgmtCaps;
    user: EnrichedVerboseUser;
    onOK?: () => void;
};

export const DeactivateUserButton = ({ capabilities, user, onOK }: DeactivateUserButtonProps) => {
    const [showDialog, setShowDialog] = React.useState(false);
    const snackbar = useSnackbar();
    const [deactivateUserMutation] = useMutation(deactivateUser);
    const confirm = useConfirm();

    const confirmContinuityRisk = (permissions: readonly string[], action: string) => confirm({
        title: "Confirm continuity risk",
        description: <>
            <p>{action} would leave no active non-Sysadmin user able to perform:</p>
            <ul>{permissions.map(permission => <li key={permission}>{permission}</li>)}</ul>
            <p>Continue anyway?</p>
        </>,
    });

    const runContinuitySensitiveMutation = async (
        knownWarnings: readonly string[],
        action: string,
        mutation: (acknowledgeContinuityRisk: boolean) => Promise<unknown>,
    ): Promise<boolean> => {
        let acknowledged = false;
        if (knownWarnings.length > 0) {
            acknowledged = await confirmContinuityRisk(knownWarnings, action);
            if (!acknowledged) return false;
        }

        try {
            await mutation(acknowledged);
            return true;
        } catch (error) {
            const newlyDetectedWarnings = getContinuityPermissionsFromError(error);
            if (!acknowledged && newlyDetectedWarnings.length > 0) {
                const retry = await confirmContinuityRisk(newlyDetectedWarnings, action);
                if (!retry) return false;
                await mutation(true);
                return true;
            }
            throw error;
        }
    };

    return <>
        {capabilities.canDeactivate && <Tooltip title="Deactivate this account and revoke its sessions.">
            <Button onClick={async () => {
                if (!await confirm({
                    description: `Deactivate ${user.name}'s account?`,
                    title: "Deactivate user",
                })) return;

                try {
                    const changed = await runContinuitySensitiveMutation(
                        capabilities.deactivationContinuityWarnings,
                        `Deactivating ${user.name}`,
                        acknowledgeContinuityRisk => deactivateUserMutation({
                            userId: user.id,
                            acknowledgeContinuityRisk,
                        }),
                    );
                    if (!changed) return;
                    snackbar.showSuccess("User deactivated");
                    // TODO: are you still allowed to see this page?
                    // if not, redirect to the user search page
                    // but for sysadmins who can see deactivated users, stay.
                    //void router.push(Routes.UserSearchPage());
                } catch (error) {
                    console.error(error);
                    snackbar.showError("Unable to deactivate user; see console");
                }
            }} startIcon={gIconMap.Delete()}>Deactivate</Button>
        </Tooltip>}
    </>;
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
    const [capabilities, { refetch: refetchCapabilities }] = useQuery(
        getUserManagementCapabilities,
        { userId: props.user.id },
    );

    const hasAnyControl = Object.entries(capabilities)
        .some(([key, value]) => key.startsWith("can") && value === true);
    if (!hasAnyControl) return null;

    capabilities.canCorrectEmail

    return <div>
        <EditUserProfileButton
            capabilities={capabilities}
            readonly={props.readonly}
            tableClient={props.tableClient}
            user={props.user}
            onOK={() => {
                props.refetch?.();
            }}
        />

        <CorrectUserEmailButton
            capabilities={capabilities}
            user={props.user}
            onOK={() => {
                props.refetch?.();
            }}
        />

        <DeactivateUserButton
            capabilities={capabilities}
            user={props.user}
            onOK={() => {
                props.refetch?.();
            }}
        />

        {capabilities.canResetPassword && <AdminResetPasswordButton user={props.user} />}

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
