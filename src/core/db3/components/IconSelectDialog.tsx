import { Box, FormHelperText } from "@mui/material";
import React from "react";
import { TIconOptions, gIconOptions } from "shared/utils";
import { CMSelectDisplayStyle, SelectionField } from "../../components/select/SelectionField";
import { CMSelectNullBehavior, makeLocalSelectionSource, singleSelectionValue, withNullSelection } from "../../components/select/selectionSource";
import { RenderMuiIcon } from "./IconMap";

export interface ChooseIconDialogProps {
    value: TIconOptions | null;
    validationError: string | null;
    onOK: (value: TIconOptions | null) => void;
    readonly: boolean;
    allowNull: boolean;
};

export function IconEditCell(props: ChooseIconDialogProps) {
    const errorId = React.useId();
    const nullBehavior = props.allowNull ? CMSelectNullBehavior.AllowNull : CMSelectNullBehavior.NonNullable;
    const source = withNullSelection(makeLocalSelectionSource<TIconOptions>({
        items: Object.keys(gIconOptions) as TIconOptions[],
        getKey: icon => icon,
        getLabel: icon => `${icon} icon`,
        renderValue: icon => <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, overflowWrap: "anywhere" }}>{RenderMuiIcon(icon)}<span>{icon}</span></Box>,
    }), nullBehavior, () => "No icon");

    return <Box role="group" aria-label="Icon" aria-describedby={props.validationError ? errorId : undefined}>
        <SelectionField source={source} value={singleSelectionValue(props.value, nullBehavior)}
            onChange={values => props.onOK(values[0]!)} readonly={props.readonly}
            displayStyle={CMSelectDisplayStyle.SelectedWithDialog} dialogTitle="Icon" />
        {props.validationError && <FormHelperText id={errorId} error>{props.validationError}</FormHelperText>}
    </Box>;
}
