import { useMutation, useQuery } from "@blitzjs/rpc";
import { Alert, Button, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import React, { Suspense } from "react";
import addUserSignInMethod from "src/auth/mutations/addUserSignInMethod";
import removeUserSignInMethod from "src/auth/mutations/removeUserSignInMethod";
import getUserSignInMethods from "src/auth/queries/getUserSignInMethods";
import { SignInMethodSchema } from "src/auth/signInMethodSchemas";
import { CMChip, CMChipContainer } from "../CMChip";
import { CMButton } from "../CMCoreComponents2";
import { CMDialog } from "../CMDialog";
import { useConfirm } from "../ConfirmationDialog";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import type { EnrichedVerboseUser } from "./UserListItem";
import { xUserSignInMethod } from "src/core/db3/shared/schema/userSignInMethod";

type Props = { user: EnrichedVerboseUser; onChanged?: () => void };

const SignInMethodsEditor = ({ user, onChanged }: Props) => {
    const [data, { refetch }] = useQuery(getUserSignInMethods, { userId: user.publicId });
    const [addMethod] = useMutation(addUserSignInMethod);
    const [removeMethod] = useMutation(removeUserSignInMethod);
    const confirm = useConfirm();
    const [type, setType] = React.useState<"email" | "google">("email");
    const [identifier, setIdentifier] = React.useState("");
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const apply = async (operation: () => Promise<unknown>) => {
        setPending(true);
        setError(null);
        try {
            await operation();
            setIdentifier("");
            await refetch();
            await onChanged?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to update sign-in methods.");
        } finally {
            setPending(false);
        }
    };

    return <Stack spacing={2}>
        <div>Note: All email methods use the same account password.</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>Password: <CMChipContainer><CMChip>{data.hasPassword ? "set" : "not set"}</CMChip></CMChipContainer></div>
        {user.isDeleted && <Alert severity="info">This user is deactivated. These methods remain reserved and cannot sign in until the user is reactivated.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <Table size="small">
            <TableHead><TableRow><TableCell>Type</TableCell><TableCell>Identifier</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>{data.methods.map(method => <TableRow key={xUserSignInMethod.getIdentity(method)}>
                <TableCell>{method.type === "email" ? "Email" : "Google subject"}</TableCell>
                <TableCell sx={{ overflowWrap: "anywhere" }}>{method.identifier}</TableCell>
                <TableCell><Button disabled={pending} onClick={async () => {
                    if (!await confirm({
                        title: "Release sign-in method?",
                        description: `Remove ${method.identifier} from ${user.name}?`,
                    })) return;
                    await apply(() => removeMethod({ userId: user.publicId, methodPublicId: xUserSignInMethod.getIdentity(method) }));
                }}>Remove</Button></TableCell>
            </TableRow>)}</TableBody>
        </Table>
        {data.methods.length === 0 && <div>No sign-in methods attached.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#f5f5f5", padding: "16px", borderRadius: "8px" }}>
            <Typography variant="h6">Add Sign-In Method</Typography>
            <TextField select label="Method type" value={type} disabled={pending} onChange={event => {
                const value = event.target.value;
                if (value === "email" || value === "google") setType(value);
                setIdentifier("");
            }}>
                <MenuItem value="email">Email</MenuItem><MenuItem value="google">Google subject</MenuItem>
            </TextField>
            <TextField label={type === "email" ? "Email address" : "Google subject ID (sub)"} value={identifier} disabled={pending}
                onChange={event => setIdentifier(event.target.value)}
                helperText={type === "google" ? "Use the provider subject ID, not the Google email address." : "Adding this address grants sign-in access with the existing account password."} />
            <div>
                <Button disabled={pending || !identifier.trim()} onClick={() => apply(async () => {
                    const method = SignInMethodSchema.parse({ type, identifier });
                    await addMethod({ userId: user.publicId, method });
                })}>
                    Add method
                </Button>
            </div>
        </div>
        {!user.isDeleted && <AdminResetPasswordButton user={user} />}
    </Stack>;
};

export const UserSignInMethodsButton = (props: Props) => {
    const [open, setOpen] = React.useState(false);
    return <>
        <CMButton onClick={() => setOpen(true)}>Manage Sign-in methods</CMButton>
        <CMDialog
            open={open}
            onClose={() => setOpen(false)}
            fullWidth
            maxWidth="sm"
            title={<>Sign-in methods for {props.user.name}</>}
            actions={<Button onClick={() => setOpen(false)}>Close</Button>}
        >
            {open && <Suspense fallback={<div>Loading sign-in methods...</div>}>
                <SignInMethodsEditor {...props} />
            </Suspense>}
        </CMDialog>
    </>;
};
