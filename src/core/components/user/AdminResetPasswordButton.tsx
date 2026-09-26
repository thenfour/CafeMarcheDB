
import { useMutation } from "@blitzjs/rpc";
import { Button } from "@mui/material";
import * as React from 'react';
import { Permission } from "shared/permissions";
import forgotPassword from "src/auth/mutations/forgotPassword";
import { CMButton } from "src/core/components/CMCoreComponents2";
import { CMDialog } from "../CMDialog";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import type * as db3 from "src/core/db3/db3";

export const AdminResetPasswordButton = ({ user }: { user: Pick<db3.UserClientPayload, "publicId" | "name" | "email"> }) => {
    const [showConfirm, setShowConfirm] = React.useState<boolean>(false);
    const [resetURL, setResetURL] = React.useState<string | null>(null);
    const [showCopied, setShowCopied] = React.useState<boolean>(false);
    const [forgotPasswordMutation] = useMutation(forgotPassword);
    const dashboardContext = useDashboardContext();

    const handleConfirmClick = () => {
        forgotPasswordMutation({ userId: user.publicId }).then((r) => {
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
            <CMDialog
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
                open={true}
                onClose={() => setShowConfirm(false)}
                title={<>Reset password for {user.name} ({user.email})</>}
                actions={<>
                    <Button onClick={() => setShowConfirm(false)}>Cancel</Button>
                    <Button autoFocus={true} onClick={handleConfirmClick}>Continue</Button>
                </>}
            >
                This will generate a temporary URL which can be used to reset a user's password.
                Send it to the user so they can restore their password.
            </CMDialog>
        }
        {resetURL &&
            <CMDialog
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
                open={true}
                className="resetPasswordURLDialog"
                onClose={() => { setShowCopied(false); setResetURL(null) }}
                title="Here's your link"
                actions={<Button autoFocus={true} onClick={() => { setShowCopied(false); setResetURL(null) }}>Close</Button>}
            >
                Click to copy the link to the clipboard
                <div role="button" className="resetPasswordURLCopyButton" onClick={onCopy}>
                    <div className="emphasizedURL">{resetURL}</div>
                </div>
                {showCopied && <div className="copiedIndicator">Copied!</div>}
            </CMDialog>
        }
    </>;
};
