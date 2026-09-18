
import { useMutation } from "@blitzjs/rpc";
import { Button, DialogContent, DialogTitle, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import * as React from 'react';
import { Permission } from "shared/permissions";
import forgotPassword from "src/auth/mutations/forgotPassword";
import { CMButton, DialogActionsCM } from "src/core/components/CMCoreComponents2";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { EnrichedVerboseUser } from "./UserListItem";

export const AdminResetPasswordButton = ({ user }: { user: EnrichedVerboseUser }) => {
    const [showConfirm, setShowConfirm] = React.useState<boolean>(false);
    const [resetURL, setResetURL] = React.useState<string | null>(null);
    const [showCopied, setShowCopied] = React.useState<boolean>(false);
    const [forgotPasswordMutation] = useMutation(forgotPassword);
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
    const dashboardContext = useDashboardContext();

    const handleConfirmClick = () => {
        forgotPasswordMutation({ userId: user.id }).then((r) => {
            setShowConfirm(false);
            setResetURL(r);
        }).catch(e => {
            console.log(e);
            alert(`error; see console.`);
        });
    };


    const onCopy = async () => {
        await navigator.clipboard.writeText(resetURL || "");
        setShowCopied(true);
    };

    if (!dashboardContext.isAuthorized(Permission.sysadmin)) {
        return null;
    }

    return <>
        <CMButton onClick={() => setShowConfirm(true)}>
            Reset password
        </CMButton>
        {showConfirm &&
            <ResponsiveDialog
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
                open={true}
                onClose={() => setShowConfirm(false)}
            >
                <DialogTitle>Reset password for {user.name} ({user.email})</DialogTitle>
                <DialogContent dividers>
                    This will generate a temporary URL which can be used to reset a user's password.
                    Send it to the user so they can restore their password.
                    <DialogActionsCM>
                        <Button onClick={() => setShowConfirm(false)}>Cancel</Button>
                        <Button autoFocus={true} onClick={handleConfirmClick}>Continue</Button>
                    </DialogActionsCM>
                </DialogContent>
            </ResponsiveDialog>
        }
        {resetURL &&
            <ResponsiveDialog
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
                open={true}
                className={`resetPasswordURLDialog ${isMdUp ? "bigScreen" : "smallScreen"}`}
                onClose={() => { setShowCopied(false); setResetURL(null) }}
            >
                <DialogTitle>Here's your link</DialogTitle>
                <DialogContent dividers>
                    Click to copy the link to the clipboard
                    <div role="button" className="resetPasswordURLCopyButton" onClick={onCopy}>
                        <div className="emphasizedURL">{resetURL}</div>
                    </div>
                    {showCopied && <div className="copiedIndicator">Copied!</div>}
                    <DialogActionsCM>
                        <Button autoFocus={true} onClick={() => { setShowCopied(false); setResetURL(null) }}>Close</Button>
                    </DialogActionsCM>
                </DialogContent>
            </ResponsiveDialog>
        }
    </>;
};
