
import { useMutation } from "@blitzjs/rpc";
import { Button, Dialog, DialogContent, DialogTitle, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import * as React from 'react';
import forgotPassword from "src/auth/mutations/forgotPassword";
import { DialogActionsCM } from "src/core/components/CMCoreComponents2";
import * as db3 from "src/core/db3/db3";

export const AdminResetPasswordButton = ({ user }: { user: db3.EnrichedVerboseUser }) => {
    const [showConfirm, setShowConfirm] = React.useState<boolean>(false);
    const [resetURL, setResetURL] = React.useState<string | null>(null);
    const [showCopied, setShowCopied] = React.useState<boolean>(false);
    const [forgotPasswordMutation, { isSuccess }] = useMutation(forgotPassword);
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

    const handleConfirmClick = () => {
        forgotPasswordMutation({ email: user.email }).then((r) => {
            setShowConfirm(false);
            setResetURL(r);
        }).catch(e => {
            console.log(e);
            alert(`error; see console.`);
        });
    };


    const onCopy = async () => {
        console.log(resetURL);
        await navigator.clipboard.writeText(resetURL || "");
        setShowCopied(true);
    };


    return <>
        <Button onClick={() => setShowConfirm(true)}>
            Reset password
        </Button>
        {showConfirm &&
            <Dialog
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
            </Dialog>
        }
        {resetURL &&
            <Dialog
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
            </Dialog>
        }
    </>;
};
