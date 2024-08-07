


// TODO: how is this different from DB3EditRowButton ? is it different at all or did i accidentally write this twice?

import { useAuthenticatedSession } from "@blitzjs/auth";
import { Button } from "@mui/material";
import React from "react";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import * as db3 from "src/core/db3/db3";
import { DB3EditObjectDialog } from "../db3/components/db3NewObjectDialog";
import * as DB3Client from "src/core/db3/DB3Client";
import { TAnyModel } from "../db3/shared/apiTypes";


////////////////////////////////////////////////////////////////
// this control is a button which pops up a dialog.
// the dialog hosts a db3 client edit form
export interface EditFieldsDialogButtonApi {
    close: () => void;
};
export interface EditFieldsDialogButtonProps<TRowModel extends TAnyModel> {
    readonly: boolean;
    tableSpec: DB3Client.xTableClientSpec;
    renderButtonChildren: () => React.ReactNode;
    onCancel: () => void;
    onOK: (obj: TRowModel, tableClient: DB3Client.xTableRenderClient, api: EditFieldsDialogButtonApi) => void;
    onDelete?: (api: EditFieldsDialogButtonApi) => void;
    initialValue: TRowModel;
    dialogTitle: string;
    dialogDescription: React.ReactNode;
};
export const EditFieldsDialogButton = <TRowModel extends TAnyModel,>(props: EditFieldsDialogButtonProps<TRowModel>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };
    const publicData = useAuthenticatedSession();

    const authorizedForEdit = props.tableSpec.args.table.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: props.initialValue,
    });

    const readonly = !authorizedForEdit || props.readonly;

    const api: EditFieldsDialogButtonApi = {
        close: () => setIsOpen(false),
    };

    const onDelete = !!props.onDelete && authorizedForEdit ? () => {
        props.onDelete!(api);
    } : undefined;

    return <>
        {!readonly && <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.renderButtonChildren()}</Button>}
        {isOpen && !readonly && <DB3EditObjectDialog
            initialValue={props.initialValue as TAnyModel}
            onCancel={() => {
                props.onCancel();
                setIsOpen(false);
            }}
            onOK={(obj, tableClient) => {
                props.onOK(obj as TRowModel, tableClient, api);
            }}
            onDelete={onDelete}
            table={props.tableSpec}
            clientIntention={clientIntention}
            description={props.dialogDescription}
        />
        }
    </>;
};





