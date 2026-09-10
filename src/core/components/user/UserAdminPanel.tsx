import { Routes } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import {
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Tooltip,
} from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import assignUserRole from "src/auth/mutations/assignUserRole";
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
import { kContinuityAcknowledgementErrorPrefix } from "@/src/auth/server/userManagementPolicy";

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

export const UserAdminPanel = (props: UserAdminPanelProps) => {
    const snackbar = useSnackbar();
    const router = useRouter();
    const confirm = useConfirm();
    const [showRoleDialog, setShowRoleDialog] = React.useState(false);
    const [selectedRoleId, setSelectedRoleId] = React.useState<number | null>(props.user.roleId);
    const [capabilities, { refetch: refetchCapabilities }] = useQuery(
        getUserManagementCapabilities,
        { userId: props.user.id },
    );
    const [assignUserRoleMutation] = useMutation(assignUserRole);
    const [deactivateUserMutation] = useMutation(deactivateUser);
    const [setUserSysAdminMutation] = useMutation(setUserSysAdmin);

    const refetch = async () => {
        props.refetch?.();
        await refetchCapabilities();
    };

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

    const selectedRole = capabilities.assignableRoles.find(role => role.id === selectedRoleId);
    const selectedRoleWarnings = selectedRoleId == null
        ? capabilities.unassignedRoleContinuityWarnings
        : selectedRole?.continuityWarnings || [];

    const hasAnyControl = Object.entries(capabilities)
        .some(([key, value]) => key.startsWith("can") && value === true);
    if (!hasAnyControl) return null;

    return <div>
        {capabilities.canEdit && <EditFieldsDialogButton
            readonly={props.readonly}
            dialogTitle="Edit user profile"
            tableSpec={props.tableClient.tableSpec}
            initialValue={props.user}
            onCancel={() => { }}
            onOK={async (updatedUser, tableClient, api) => {
                await snackbar.invokeAsync(async () => {
                    await props.tableClient.doUpdateMutation(updatedUser);
                    props.refetch?.();
                    api.close();
                });
            }}
            dialogDescription={null}
            renderButtonChildren={() => "Edit profile"}
        />}

        {capabilities.canAssignRole && <>
            <Button onClick={() => {
                setSelectedRoleId(props.user.roleId);
                setShowRoleDialog(true);
            }}>
                Assign role
            </Button>
            <Dialog open={showRoleDialog} onClose={() => setShowRoleDialog(false)}>
                <DialogTitle>Assign role for {props.user.name}</DialogTitle>
                <DialogContent dividers>
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="user-role-label">Role</InputLabel>
                        <Select
                            labelId="user-role-label"
                            label="Role"
                            value={selectedRoleId ?? ""}
                            onChange={event => setSelectedRoleId(
                                event.target.value === "" ? null : Number(event.target.value),
                            )}
                        >
                            <MenuItem value=""><em>No role</em></MenuItem>
                            {capabilities.assignableRoles.map(role => (
                                <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <DialogActionsCM>
                        <Button onClick={() => setShowRoleDialog(false)}>Cancel</Button>
                        <Button autoFocus onClick={async () => {
                            try {
                                const changed = await runContinuitySensitiveMutation(
                                    selectedRoleWarnings,
                                    `Changing role for ${props.user.name}`,
                                    acknowledgeContinuityRisk => assignUserRoleMutation({
                                        userId: props.user.id,
                                        roleId: selectedRoleId,
                                        acknowledgeContinuityRisk,
                                    }),
                                );
                                if (!changed) return;
                                snackbar.showSuccess("Role updated");
                                setShowRoleDialog(false);
                                await refetch();
                            } catch (error) {
                                console.error(error);
                                snackbar.showError("Unable to update role; see console");
                            }
                        }}>Save</Button>
                    </DialogActionsCM>
                </DialogContent>
            </Dialog>
        </>}

        {capabilities.canDeactivate && <Tooltip title="Deactivate this account and revoke its sessions.">
            <Button onClick={async () => {
                if (!await confirm({
                    description: `Deactivate ${props.user.name}'s account?`,
                    title: "Deactivate user",
                })) return;

                try {
                    const changed = await runContinuitySensitiveMutation(
                        capabilities.deactivationContinuityWarnings,
                        `Deactivating ${props.user.name}`,
                        acknowledgeContinuityRisk => deactivateUserMutation({
                            userId: props.user.id,
                            acknowledgeContinuityRisk,
                        }),
                    );
                    if (!changed) return;
                    snackbar.showSuccess("User deactivated");
                    void router.push(Routes.UserSearchPage());
                } catch (error) {
                    console.error(error);
                    snackbar.showError("Unable to deactivate user; see console");
                }
            }} startIcon={gIconMap.Delete()}>Deactivate</Button>
        </Tooltip>}

        {capabilities.canResetPassword && <AdminResetPasswordButton user={props.user} />}
        {capabilities.canSetSysAdmin && <Button onClick={async () => {
            const isSysAdmin = !props.user.isSysAdmin;
            if (!await confirm({
                title: isSysAdmin ? "Grant Sysadmin" : "Revoke Sysadmin",
                description: `${isSysAdmin ? "Grant" : "Revoke"} actual Sysadmin status for ${props.user.name}?`,
            })) return;
            await snackbar.invokeAsync(async () => {
                await setUserSysAdminMutation({ userId: props.user.id, isSysAdmin });
                await refetch();
            }, "Sysadmin status updated");
        }}>{props.user.isSysAdmin ? "Revoke Sysadmin" : "Grant Sysadmin"}</Button>}
        {capabilities.canImpersonate && <ImpersonateUserButton userId={props.user.id} />}
    </div>;
};
