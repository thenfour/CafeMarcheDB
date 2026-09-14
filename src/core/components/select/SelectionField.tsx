import { Box, Checkbox, Radio, RadioGroup } from "@mui/material";
import React from "react";
import { CMChipContainer } from "../CMChip";
import { SelectionPicker, SelectionQueryStatus } from "./SelectionPicker";
import { SelectionValue, SelectionValueList } from "./SelectionOptions";
import { SelectionSource, selectionText } from "./selectionSource";

export enum CMSelectDisplayStyle {
    CustomButtonWithDialog = "CustomButtonWithDialog",
    SelectedWithDialog = "SelectedWithDialog",
    AllWithDialog = "AllWithDialog",
    AllWithInlineEditing = "AllWithInlineEditing",
}

export const SelectionEditButton = (props: React.PropsWithChildren<{ onClick: () => void; label: string }>) => <Box
    component="button" type="button" className="interactable freeButton CMTextButton enabled"
    aria-label={props.label} onClick={props.onClick}
    sx={{ font: "inherit", lineHeight: "inherit", border: 0, flexShrink: 0, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}
>{props.children || "Edit"}</Box>;

export const SelectionFieldFrame = (props: React.PropsWithChildren) => <CMChipContainer style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, minWidth: 0 }}>{props.children}</CMChipContainer>;

export interface SelectionFieldProps<T> {
    source: SelectionSource<T>;
    value: T[];
    onChange: (value: T[]) => void;
    multiple?: boolean;
    readonly?: boolean;
    displayStyle?: CMSelectDisplayStyle;
    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;
    allowQuickFilter?: boolean;
    customRender?: (open: () => void) => React.ReactNode;
    className?: string;
}

export function SelectionField<T>(props: SelectionFieldProps<T>) {
    const [open, setOpen] = React.useState(false);
    const style = props.displayStyle || CMSelectDisplayStyle.AllWithInlineEditing;
    const showAll = style === CMSelectDisplayStyle.AllWithDialog || style === CMSelectDisplayStyle.AllWithInlineEditing;
    const query = props.source.useOptions("", showAll);
    const openDialog = () => { if (!props.readonly) setOpen(true); };
    const selectedKeys = new Set(props.value.map(props.source.getKey));
    const inline = style === CMSelectDisplayStyle.AllWithInlineEditing;
    const items = showAll ? query.items : props.value;
    const buttonText = props.editButtonChildren || (props.value.length ? "Edit" : "Select");
    const edit = !props.readonly && <SelectionEditButton onClick={openDialog} label={`${selectionText(buttonText) || "Edit"} ${selectionText(props.dialogTitle) || "selection"}`}>{buttonText}</SelectionEditButton>;
    const values = inline ? <>
        {items.map(item => {
            const selected = selectedKeys.has(props.source.getKey(item));
            const choose = () => {
                if (props.readonly) return;
                props.onChange(props.multiple ? selected ? props.value.filter(value => props.source.getKey(value) !== props.source.getKey(item)) : [...props.value, item] : [item]);
            };
            return <Box component="label" key={props.source.getKey(item)} sx={{ display: "inline-flex", alignItems: "center", minWidth: 0, "&:focus-within": { outline: "2px solid", outlineColor: "primary.main" } }}>
                {props.multiple ? <Checkbox size="small" checked={selected} disabled={props.readonly || query.isPreviousData} onChange={choose} inputProps={{ "aria-label": props.source.getLabel(item) }} />
                    : <Radio size="small" value={String(props.source.getKey(item))} checked={selected} disabled={props.readonly || query.isPreviousData} onChange={choose} inputProps={{ "aria-label": props.source.getLabel(item) }} />}
                <SelectionValue>{props.source.renderValue(item)}</SelectionValue>
            </Box>;
        })}
        {edit}
    </> : <>
        <SelectionValueList value={items} getKey={props.source.getKey} getLabel={props.source.getLabel} renderValue={item => <Box sx={{ opacity: showAll && !selectedKeys.has(props.source.getKey(item)) ? 0.55 : 1 }}>{props.source.renderValue(item)}</Box>}>
            {edit}
        </SelectionValueList>
    </>;
    return <Box className={props.className} sx={{ minWidth: 0 }}>
        {style === CMSelectDisplayStyle.CustomButtonWithDialog ? props.customRender?.(openDialog)
            : inline ? (!props.multiple ? <RadioGroup row aria-label={selectionText(props.dialogTitle) || "Choose one option"}><SelectionFieldFrame>{values}</SelectionFieldFrame></RadioGroup> : <SelectionFieldFrame>{values}</SelectionFieldFrame>) : values}
        {showAll && <SelectionQueryStatus query={query} />}
        {open && !props.readonly && <SelectionPicker source={props.source} value={props.value} multiple={props.multiple}
            title={props.dialogTitle || (props.multiple ? "Select options" : "Select an option")} description={props.dialogDescription}
            allowQuickFilter={props.allowQuickFilter} onCancel={() => setOpen(false)} onOptionsChanged={query.refetch}
            onAccept={value => { props.onChange(value); setOpen(false); }} />}
    </Box>;
}
