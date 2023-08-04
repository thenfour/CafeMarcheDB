// multiple foreign objects which form an association
// at  first feels like it should be complex, however it's just an array instead of a singular value.
// sure there's an association table & foreign table, but it's not necessary to care about that.
// the "value type" of the column is TAssociation[].

// with single cell, you have
// Model.roleId
// Model.role

// Role.id

// but with multiple, you have no FKID field on model...
// Model.roles
// IntermediateTable.modelId
// IntermediateTable.roleId
// Role.id

// and updates will now encompass possibly delete / update / create
// so your mutation should be designed in a way to abstract that list processing.

// So there is not only the foreign object, but the association itself.
// the datatype of the column is Association[].
// and knowing that, it's pretty straight-forward to implement as an editor for that datatype.
// but in order to do some internal plumbing, like creating associations, you still need some info about the parent type.

// the cell class here doesnt' really need to do much; the magic will be in the popup.
import {
    Button
} from "@mui/material";
import {
    Add as AddIcon,
    Close as CancelIcon,
    DeleteOutlined as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import {
    GridCellModes,
    GridRenderEditCellParams,
    useGridApiContext
} from '@mui/x-data-grid';
import React from "react";
import { CMGridEditCellMultiFKSpec, CMGridEditCellSpec } from "./dbcomponents2/CMColumnSpec";
import { CMSelectMultiDialog } from "./CMSelectManyDialog";

type CMGridRenderEditCellMultiFKParams<TRow, TAssociation> = GridRenderEditCellParams & {
    spec: CMGridEditCellMultiFKSpec<TRow, TAssociation>,
    //value: TAssociation[],
    //row: TRow,
};


// note that the items you display should NOT include ones which are already added.
// so the list filtering needs to know the old value.
export function CMGridEditCellMultiFK<TRow, TAssociation>({ id, row: row_, value: value_, field, spec }: CMGridRenderEditCellMultiFKParams<TRow, TAssociation>) {
    const row = row_ as TRow; // is there a more elegant way of adding specificicity?
    const value = (value_ || []) as TAssociation[];
    const apiRef = useGridApiContext();
    const [showingSelectDialog, setShowingSelectDialog] = React.useState<boolean>(false);

    console.assert(!!row);

    if (showingSelectDialog) {
        // show dialog instead of value.
        const onOK = (newValue: TAssociation[]) => {
            apiRef.current.setEditCellValue({ id, field, value: newValue })!.then(() => {
                setShowingSelectDialog(false);
            }).catch((err) => {
                console.error(err);
                setShowingSelectDialog(false);
                throw err;
            });
        };

        // for single-item foreign object fields, this is a SELECT operation (which cares about the incoming item).
        // for multi-item, this is an ADD operation. there is no initial item, hence value=null.
        return <CMSelectMultiDialog<TRow, TAssociation>
            rowObject={row}
            spec={spec.SelectMultiDialogSpec}
            value={value}
            onCancel={() => { setShowingSelectDialog(false) }}
            onOK={onOK} />;
    }

    return <>
        {
            spec.RenderEditCellValue({
                row,
                value,
                onDelete: (ass) => {
                    const newValue = value.filter(sass => !spec.SelectMultiDialogSpec.IsEqualAssociation(ass, sass));
                    apiRef.current.setEditCellValue({ id, field, value: newValue })!.then(() => {
                        //setShowingSelectDialog(false);
                    }).catch((err) => {
                        console.error(err);
                        throw err;
                    });
                    //setSelectedObj(newValue);
                }
            })
        }
        <Button startIcon={<AddIcon />} onClick={() => { setShowingSelectDialog(true) }}></Button>
    </>;
}

