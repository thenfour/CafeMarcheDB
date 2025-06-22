
import { BlitzPage, Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { Button, Dialog, DialogContent, DialogTitle, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/router";
import * as React from 'react';
import { Permission } from "shared/permissions";
import forgotPassword from "src/auth/mutations/forgotPassword";
import impersonateUser from "src/auth/mutations/impersonateUser";
import { DialogActionsCM } from "src/core/components/CMCoreComponents2";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const AdminResetPasswordButton = ({ user }: { user: db3.UserPayload }) => {
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

const UserListContent = () => {
    const router = useRouter()

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xUser,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 160 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "compactName", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "email", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "phone", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "cssClass", cellWidth: 150 }),
            new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 200 }),
            new DB3Client.BoolColumnClient({ columnName: "isSysAdmin" }),
            //new DB3Client.BoolColumnClient({ columnName: "isActive" }),
            new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName: "instruments", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "role", cellWidth: 180, }),
        ],
    });

    const [impersonateUserMutation] = useMutation(impersonateUser); const extraActions = (args: DB3EditGridExtraActionsArgs) => {
        return <div>
            <Button onClick={() => {
                impersonateUserMutation({
                    userId: args.row.id,
                }).then(() => {
                    // navigate to home page
                    void router.push(Routes.Home());
                }).catch((e) => {
                    console.log(e);
                });
            }}>
                Impersonate
            </Button>
            <AdminResetPasswordButton user={args.row as db3.UserPayload} />
        </div>;
    }

    return <DB3EditGrid tableSpec={tableSpec} renderExtraActions={extraActions} defaultSortModel={[{ field: "id", sort: "desc" }]} />;
};

const UserListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users" basePermission={Permission.admin_users}>
            <UserListContent />
        </DashboardLayout>
    );
};

export default UserListPage;
