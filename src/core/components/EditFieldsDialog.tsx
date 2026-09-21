import { useDB3Authorization } from "src/core/db3/components/useDB3Authorization";



// TODO: how is this different from DB3EditRowButton ? is it different at all or did i accidentally write this twice?

import { TAnyModel } from "@/shared/rootroot";
import React from "react";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditObjectDialog } from "../db3/components/db3NewObjectDialog";
import { CMButton } from "./CMCoreComponents2";


////////////////////////////////////////////////////////////////
// this control is a button which pops up a dialog.
// the dialog hosts a db3 client edit form
export interface EditFieldsDialogButtonApi {
    close: () => void;
};
export interface EditFieldsDialogButtonProps<
    TRowModel extends TAnyModel,
    TTableClient extends DB3Client.xTableRenderClient<any, any>,
> {
    readonly: boolean;
    tableSpec: TTableClient["tableSpec"];
    renderButtonChildren: () => React.ReactNode;
    onCancel: () => void;
    onOK: (obj: TRowModel, tableClient: TTableClient, api: EditFieldsDialogButtonApi) => void;
    onDelete?: (api: EditFieldsDialogButtonApi) => void;
    initialValue: TRowModel;
    dialogTitle: string;
    dialogDescription: React.ReactNode;
    buttonComponent?: React.ComponentType<React.ComponentProps<typeof CMButton>>;
    tableRenderClient: TTableClient;
};
export const EditFieldsDialogButton = <
    TRowModel extends TAnyModel,
    TTableClient extends DB3Client.xTableRenderClient<any, any>,
>({ buttonComponent, ...props }: EditFieldsDialogButtonProps<TRowModel, TTableClient>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);

    const publicData = useDB3Authorization();

    const authorizedForEdit = props.tableSpec.args.table.authorizeRowForEdit({
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
        {!readonly && (buttonComponent ?
            React.createElement(buttonComponent, { onClick: () => { setIsOpen(!isOpen) } }, props.renderButtonChildren()) :
            <CMButton onClick={() => { setIsOpen(!isOpen) }}>{props.renderButtonChildren()}</CMButton>)}
        {isOpen && !readonly && <DB3EditObjectDialog
            initialValue={props.initialValue as TAnyModel}
            onCancel={() => {
                props.onCancel();
                setIsOpen(false);
            }}
            onOK={(obj, tableClient) => {
                // DB3EditObjectDialog is still row-agnostic, but it returns the
                // same client instance and draft shape supplied to this typed
                // wrapper.
                props.onOK(obj as TRowModel, tableClient as TTableClient, api);
            }}
            onDelete={onDelete}
            tableRenderClient={props.tableRenderClient}

            description={props.dialogDescription}
        />
        }
    </>;
};





