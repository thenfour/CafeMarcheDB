import { TAnyModel } from "@/shared/rootroot";
import {
    Alert,
    FormControl
} from "@mui/material";
import React, { Suspense } from "react";
import type { SettingKey } from "shared/settingKeys";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMDialog } from "src/core/components/CMDialog";
import { AdminInspectObject, CMButton, CMButtonGroup, CMDialogContentText, CMSmallButton } from "src/core/components/CMCoreComponents2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { useDB3Authorization } from "src/core/db3/components/useDB3Authorization";
import * as db3 from "../db3";
import * as DB3ClientCore from "./DB3ClientCore";
import { gIconMap } from "./IconMap";

////////////////////////////////////////////////////////////////
type db3NewObjectDialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => any;
    onCancel: () => any;
    table: DB3ClientCore.xTableClientSpec;
    tableRenderClient: DB3ClientCore.xTableRenderClient;


    caption?: string;
    descriptionSettingName?: SettingKey;
};

export function DB3NewObjectDialog(props: db3NewObjectDialogProps) {
    return <DB3NewObjectDialogWithClient {...props} />;
}

function DB3NewObjectDialogWithClient({
    onOK,
    onCancel,
    table,
    tableRenderClient: tableClient,
    ...props
}: db3NewObjectDialogProps & { tableRenderClient: DB3ClientCore.xTableRenderClient }) {
    const [currentUser] = useCurrentUser();
    const [obj, setObj] = React.useState(table.args.table.createNew(currentUser));
    const [oldObj, setOldObj] = React.useState(table.args.table.createNew(currentUser)); // needed for tracking changes
    const [validationResult, setValidationResult] = React.useState<db3.ValidateAndComputeDiffResult>(db3.EmptyValidateAndComputeDiffResult); // don't allow null for syntax simplicity
    const publicData = useDB3Authorization();
    const [grayed, setGrayed] = React.useState<boolean>(false);

    // validate on change
    React.useEffect(() => {
        const vr = tableClient.tableSpec.args.table.ValidateAndComputeDiff(oldObj, obj, "new");
        setValidationResult(vr);
        setOldObj(obj);
    }, [obj]);

    const handleOK = async () => {
        // check validation and disallow
        if (!validationResult.success) {
            console.log(`DB3NewObjectDialog handleOK validation error`);
            console.log(validationResult);
            return;
        }
        setGrayed(true);
        onOK(obj, tableClient);
    };

    const api: DB3ClientCore.NewDialogAPI = {
        setFieldValues: (fieldValues: { [key: string]: any }) => {
            // so i think the reason MUI datagrid's API makes this a promise, is that when you setState(), it doesn't update
            // local variables; it's asynchronous. either we go that model which is more complex, or this where you can set multiple fields at once.
            // drawback is callers don't know when the change has been applied so can't do anything afterwards.
            const newObj = { ...obj, ...fieldValues };
            setObj(newObj);
        },
    };

    let encounteredAutofocusable = false;

    return (
        <Suspense>
            <CMDialog
                open
                onClose={onCancel}
                title={props.caption || <>New {table.args.table.tableName}</>}
                actions={<>
                    <CMButton onClick={onCancel} disabled={grayed}>Cancel</CMButton>
                    <CMButton onClick={handleOK} disabled={grayed}>OK</CMButton>
                </>}
            >
                {props.descriptionSettingName && <SettingMarkdown setting={props.descriptionSettingName} />}

                <FormControl>
                    {
                        tableClient.clientColumns.filter(c => {
                            if (!c.visible) return false;
                            return tableClient.schema.authorizeColumnForInsert({
                                model: obj,
                                columnName: c.columnName,
                                publicData,
                            });
                        }).map(column => {
                            let autoFocus = false;
                            if (!encounteredAutofocusable && column.isAutoFocusable) {
                                encounteredAutofocusable = true;
                                autoFocus = true;
                            }
                            return column.renderForNewDialog && <React.Fragment key={column.columnName}>{column.renderForNewDialog!({
                                key: column.columnName,
                                api,
                                autoFocus,
                                row: obj,
                                value: obj[column.columnName],
                                validationResult,
                            })}</React.Fragment>;
                        })
                    }
                </FormControl>
            </CMDialog>
        </Suspense>
    );
};




////////////////////////////////////////////////////////////////
// similar to DB3EditObjectDialog but uses external table render client.
type DB3EditObject2DialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => void;
    onCancel: () => void;
    onDelete?: (tableClient: DB3ClientCore.xTableRenderClient) => void;
    tableRenderClient: DB3ClientCore.xTableRenderClient;
    initialValue: TAnyModel;
    title?: React.ReactNode;
    description?: React.ReactNode;
};

export function DB3EditObject2Dialog({ onOK, onCancel, tableRenderClient, initialValue, onDelete, ...props }: DB3EditObject2DialogProps) {
    const publicData = useDB3Authorization();
    const [obj, setObj] = React.useState(initialValue);
    const [oldObj, setOldObj] = React.useState(initialValue); // needed for tracking changes during validation
    const [validationResult, setValidationResult] = React.useState<db3.ValidateAndComputeDiffResult>(db3.EmptyValidateAndComputeDiffResult); // don't allow null for syntax simplicity

    const [showingDeleteConfirmation, setShowingDeleteConfirmation] = React.useState<boolean>(false);

    // validate on change
    React.useEffect(() => {
        const vr = tableRenderClient.tableSpec.args.table.ValidateAndComputeDiff(oldObj, obj, "update");
        setValidationResult(vr);
        setOldObj(obj);
    }, [obj]);

    const handleOK = () => {
        // check validation and disallow
        if (!validationResult.success) {
            console.log(`DB3NewObjectDialog handleOK validation error`);
            console.log(validationResult);
            return;
        }
        onOK(obj, tableRenderClient);
    };

    const api: DB3ClientCore.NewDialogAPI = {
        setFieldValues: (fieldValues: { [key: string]: any }) => {
            // so i think the reason MUI datagrid's API makes this a promise, is that when you setState(), it doesn't update
            // local variables; it's asynchronous. either we go that model which is more complex, or this where you can set multiple fields at once.
            // drawback is callers don't know when the change has been applied so can't do anything afterwards.
            const newObj = { ...obj, ...fieldValues };
            setObj(newObj);
        },
    };

    const handleDelete = () => {
        onDelete!(tableRenderClient);
    }

    let encounteredAutofocusable = false;

    return (
        <Suspense>
            <CMDialog
                open={true}
                onClose={onCancel}
                className="ReactiveInputDialog"
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
                title={<>
                    {props.title || <>Edit {tableRenderClient.tableSpec.args.table.tableName}</>}
                    <AdminInspectObject src={initialValue} label="initial value" />
                </>}
                actions={<>
                    <CMButton onClick={onCancel}>Cancel</CMButton>
                    <CMButton onClick={handleOK}>OK</CMButton>
                </>}
            >
                {props.description && <CMDialogContentText>{props.description}</CMDialogContentText>}
                {onDelete && (<div className="deleteConfirmationControlContainer">
                    <CMButton onClick={() => setShowingDeleteConfirmation(true)}>{gIconMap.Delete()}Delete</CMButton>
                    {showingDeleteConfirmation && (<Alert severity="warning">
                        <CMButtonGroup className="deleteConfirmationControl">
                            <span>Are you sure you want to delete this item?</span>
                            <CMButton onClick={() => setShowingDeleteConfirmation(false)}>nope, cancel</CMButton>
                            <CMButton onClick={() => { handleDelete(); setShowingDeleteConfirmation(false) }}>yes</CMButton>
                        </CMButtonGroup>
                    </Alert>)}
                </div>)}
                <FormControl>

                    {
                        tableRenderClient.clientColumns.filter(c => {
                            if (!c.visible) return false;
                            return (c.schemaTable.authorizeColumnForEdit({
                                columnName: c.columnName,
                                model: obj,
                                publicData,
                                fallbackOwnerId: null,// assume model has this.
                            }));
                        }).map(column => {
                            let autoFocus = false;
                            if (!encounteredAutofocusable && column.isAutoFocusable) {
                                encounteredAutofocusable = true;
                                autoFocus = true;
                            }
                            return column.renderForNewDialog && <React.Fragment key={column.columnName}>{column.renderForNewDialog!({
                                key: column.columnName,
                                api,
                                row: obj,
                                autoFocus,
                                value: obj[column.columnName],
                                validationResult,
                            })}</React.Fragment>;
                        })
                    }

                </FormControl>
            </CMDialog>
        </Suspense >
    );
};






////////////////////////////////////////////////////////////////
type DB3EditObjectDialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => void;
    onCancel: () => void;
    onDelete?: (tableClient: DB3ClientCore.xTableRenderClient) => void;
    tableRenderClient: DB3ClientCore.xTableRenderClient;

    initialValue: TAnyModel;
    title?: React.ReactNode;
    description?: React.ReactNode;
};

// TODO: is this the same thing as DB3EditRowButton? if so, merge them.
export function DB3EditObjectDialog({ onOK, onCancel, tableRenderClient, initialValue, onDelete, ...props }: DB3EditObjectDialogProps) {
    return <AppContextMarker name="DB3EditObjectDialog">
        <DB3EditObject2Dialog
            initialValue={initialValue}
            onCancel={onCancel}
            onOK={onOK}
            onDelete={onDelete}
            tableRenderClient={tableRenderClient}
            title={props.title}
            description={props.description}
        />
    </AppContextMarker>;
}


//////////////////////////////////////////////////////////////////
export interface DB3EditRowButtonAPI {
    closeDialog: () => void;
};

export interface DB3EditRowButtonProps {
    row: TAnyModel;
    tableRenderClient: DB3ClientCore.xTableRenderClient;
    onSave: (newRow: TAnyModel, api: DB3EditRowButtonAPI) => void;
    label?: React.ReactNode;
    smallButton?: boolean;
    onDelete?: (api: DB3EditRowButtonAPI) => void;
};

// like on the user profile, a "Edit" button which pops up a dialog to edit fields

// TODO: is this the same thing as DB3EditObjectDialog? if so, merge them.
export const DB3EditRowButton = (props: DB3EditRowButtonProps) => {
    const [editOpen, setEditOpen] = React.useState<boolean>(false);
    const publicData = useDB3Authorization();

    const deleteAuthorized = props.tableRenderClient.args.tableSpec.args.table.authorizeRowForDeletePreferSoft({
        publicData,
        model: props.row,
    });

    const buttonChildren = props.label || <>{gIconMap.Edit()}Edit</>;

    const api: DB3EditRowButtonAPI = {
        closeDialog: () => setEditOpen(false)
    };


    const onDelete = !!props.onDelete && deleteAuthorized ? () => {
        props.onDelete!(api);
    } : undefined;

    return <div className={`DB3EditRowButton`}>
        {!!props.smallButton ? (
            <CMSmallButton onClick={() => setEditOpen(true)}>{buttonChildren}</CMSmallButton>
        ) : (
            <CMButton onClick={() => setEditOpen(true)}>{buttonChildren}</CMButton>
        )}
        {editOpen && (
            <DB3EditObject2Dialog
                initialValue={props.row}
                onDelete={onDelete}
                onCancel={() => setEditOpen(false)}
                onOK={(updatedObj: TAnyModel) => {
                    props.onSave(updatedObj, api);
                }}
                tableRenderClient={props.tableRenderClient}
            />

        )}
    </div>;

};




////////////////////////////////////////////////////////////////
export interface DB3RowViewerProps {
    tableRenderClient: DB3ClientCore.xTableRenderClient;
    row: TAnyModel;
};

export const DB3RowViewer = (props: DB3RowViewerProps) => {
    return <div className="DB3RowViewer">
        {props.tableRenderClient.clientColumns.map((cc, i) => <React.Fragment key={i}>
            {cc.renderViewer({ key: i, row: props.row, value: props.row[cc.columnName] })}
        </React.Fragment>)}
    </div>;
};

