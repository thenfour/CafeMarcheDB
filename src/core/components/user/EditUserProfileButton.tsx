import type { xTableRenderClient } from "src/core/db3/components/DB3ClientCore";
import { useLegacyCrudViewCommands } from "src/core/db3/components/useCrudViewCommands";
import { userEditorView } from "src/core/db3/shared/entities/user/userViews";
import { CMUserMgmtButton } from "../CMCoreComponents2";
import { EditFieldsDialogButton } from "../EditFieldsDialog";
import { useSnackbar } from "../SnackbarContext";
import type { EnrichedVerboseUser } from "./UserListItem";

type EditUserProfileButtonProps = {
    readonly: boolean;
    tableClient: xTableRenderClient<typeof userEditorView>;
    user: EnrichedVerboseUser;
    onOK: () => void;
};

export const EditUserProfileButton = ({ readonly, tableClient, user, onOK }: EditUserProfileButtonProps) => {
    const snackbar = useSnackbar();
    const editCommands = useLegacyCrudViewCommands({
        view: userEditorView,
        tableClient,
    });
    const canEdit = tableClient.schema.authorizeRowForEdit({
        model: user,
        publicData: tableClient.publicData,
    });

    return <>{canEdit && <EditFieldsDialogButton
        buttonComponent={CMUserMgmtButton}
        readonly={readonly}
        dialogTitle="Edit user profile"
        tableSpec={tableClient.tableSpec}
        tableRenderClient={tableClient}
        initialValue={user}
        onCancel={() => { }}
        onOK={async (updatedUser, _tableClient, api) => {
            await snackbar.invokeAsync(async () => {
                await editCommands.update(updatedUser, user);
                onOK();
                api.close();
            });
        }}
        dialogDescription={null}
        renderButtonChildren={() => "Edit profile"}
    />}</>;
};
