// specifically, a single foreign object edit cell.

import {
    Button
} from "@mui/material";
import {
    GridCellModes,
    GridRenderEditCellParams,
    useGridApiContext
} from '@mui/x-data-grid';
import React, { ReactElement } from "react";
import { CMSelectItemDialog } from "src/core/cmdashboard/dbcomponents2/CMSelectItemDialog";
import { CMGridEditCellSpec } from "./dbcomponents2/CMColumnSpec";


type CMGridRenderEditCellParams<TDBModel> = GridRenderEditCellParams & {
    spec: CMGridEditCellSpec<TDBModel>
};

// the field we're editing is the OBJECT field.
export function CMGridEditCell<TDBModel>(props: CMGridRenderEditCellParams<TDBModel>) {
    const { id, value, field, spec } = props;
    console.assert(!!spec);
    const apiRef = useGridApiContext();
    const [showingSelectDialog, setShowingSelectDialog] = React.useState<boolean>(false);

    // when viewing, it's just a chip, no click or delete.
    // when editing but not in focus, same thing
    // when editing with focus, show a dropdown menu, with options to delete & create new.

    if (props.cellMode != GridCellModes.Edit) {
        // viewing.
        return spec.RenderItem({ value });
    }

    if (showingSelectDialog) {
        // show dialog instead of value.
        const onOK = (value?: TDBModel) => {
            console.assert(spec.FKObjectMemberName === field); // assert that we're operating on object column, not the ID column.
            console.assert(!!spec.GetIDOfFieldValue); // this is designed only for foreign object types
            apiRef.current.setEditCellValue({ id, field, value: (value || null) })!.then(() => {
                apiRef.current.setEditCellValue({ id, field: spec.FKIDMemberName, value: spec.GetIDOfFieldValue!(value) })!.then(() => {
                    setShowingSelectDialog(false);
                }).catch(() => { });
            }).catch(() => { });
            ;
        };
        return <CMSelectItemDialog spec={spec.SelectItemDialogSpec} value={props.value} onCancel={() => { setShowingSelectDialog(false) }} onOK={onOK} />;
    }
    return <>
        {spec.RenderItem({ value })}
        <Button onClick={() => { setShowingSelectDialog(true) }}>Select...</Button>
    </>;
}

