import { Box } from "@mui/material";
import React from "react";
import { CMChipContainer } from "../CMChip";
import { ChoiceControl, ChoiceInteraction } from "../ChoiceControl";
import { SelectionPicker, SelectionQueryStatus } from "./SelectionPicker";
import { SelectionValue, SelectionValueList } from "./SelectionOptions";
import { SelectionSource, selectionText } from "./selectionSource";

export enum CMSelectDisplayStyle {
    CustomButtonWithDialog = "CustomButtonWithDialog",
    SelectedWithDialog = "SelectedWithDialog",
    SelectedAsDialogTrigger = "SelectedAsDialogTrigger",
    AllWithDialog = "AllWithDialog",
    AllWithInlineEditing = "AllWithInlineEditing",
}

export const SelectionEditButton = (props: React.PropsWithChildren<{ onClick: () => void; label: string }>) => (
    <Box
        component="button"
        type="button"
        className="interactable freeButton CMTextButton enabled"
        aria-label={props.label}
        onClick={props.onClick}
        sx={{ font: "inherit", lineHeight: "inherit", border: 0, flexShrink: 0, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}
    >
        {props.children || "Edit"}
    </Box>);

export const SelectionFieldFrame = (props: React.PropsWithChildren) => (
    <CMChipContainer
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, minWidth: 0 }}
    >
        {props.children}
    </CMChipContainer>);

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
    const groupName = React.useId();
    const fieldRef = React.useRef<HTMLDivElement>(null);
    const wasOpen = React.useRef(false);
    const style = props.displayStyle || CMSelectDisplayStyle.AllWithInlineEditing;
    const valuesOpenDialog = style === CMSelectDisplayStyle.SelectedAsDialogTrigger;
    React.useEffect(() => {
        // A changed selection can remove the button to which the dialog restores focus.
        if (wasOpen.current && !open && valuesOpenDialog && !props.readonly && document.activeElement === document.body) {
            fieldRef.current?.querySelector<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]')?.focus();
        }
        wasOpen.current = open;
    }, [open, valuesOpenDialog, props.readonly]);
    const showAll = style === CMSelectDisplayStyle.AllWithDialog || style === CMSelectDisplayStyle.AllWithInlineEditing;
    const query = props.source.useOptions("", showAll);
    const openDialog = () => {
        if (!props.readonly) {
            setOpen(true);
        }
    };
    const selectedKeys = new Set(props.value.map(props.source.getKey));
    const inline = style === CMSelectDisplayStyle.AllWithInlineEditing;
    const items = showAll ? query.items : props.value;
    const buttonText = props.editButtonChildren || (props.value.length ? "Edit" : "Select");
    const edit = !props.readonly && !valuesOpenDialog && <SelectionEditButton onClick={openDialog} label={`${selectionText(buttonText) || "Edit"} ${selectionText(props.dialogTitle) || "selection"}`}>{buttonText}</SelectionEditButton>;
    const dialogInteraction: ChoiceInteraction = { kind: "action", onActivate: openDialog, hasPopup: "dialog", expanded: open };
    const disabled = !!props.readonly || !!query.isPreviousData || !!query.isLoading;
    const activate = (item: T) => {
        if (disabled || !inline) {
            return;
        }
        const key = props.source.getKey(item);
        const selected = selectedKeys.has(key);
        if (!props.multiple) {
            if (!selected) {
                props.onChange([item]);
            }
            return;
        }
        props.onChange(selected ? props.value.filter(value => props.source.getKey(value) !== key) : [...props.value, item]);
    };
    const choices = showAll ? <Box role={inline && !props.multiple ? "radiogroup" : "group"} aria-label={selectionText(props.dialogTitle) || "Available options"}>
        <SelectionFieldFrame>
            {items.map(item => <SelectionValue key={props.source.getKey(item)}>
                {props.source.renderChoice({
                    item,
                    selected: selectedKeys.has(props.source.getKey(item)),
                    disabled,
                    label: props.source.getLabel(item),
                    interaction: inline ? {
                        kind: "selection",
                        selectionMode: props.multiple ? "multiple" : "single",
                        name: groupName,
                        value: String(props.source.getKey(item)),
                        onActivate: () => activate(item),
                    } : null,
                })}
            </SelectionValue>)}
            {edit}
        </SelectionFieldFrame>
    </Box> : null;
    const selectedValues = <>
        <SelectionValueList
            value={items}
            getKey={props.source.getKey}
            getLabel={props.source.getLabel}
            renderValue={props.source.renderValue}>
            {edit}
        </SelectionValueList>
    </>;
    const selectedDisplay = valuesOpenDialog && !props.readonly ? <SelectionFieldFrame>
        {props.value.map(item => <SelectionValue key={props.source.getKey(item)}>
            {props.source.renderChoice({
                item,
                selected: true,
                disabled: false,
                label: `Edit ${props.source.getLabel(item)}`,
                interaction: dialogInteraction,
            })}
        </SelectionValue>)}
        {props.value.length === 0 && <ChoiceControl
            selected={false} disabled={false} label={`Select ${selectionText(props.dialogTitle) || "options"}`}
            interaction={dialogInteraction} className="CMTextButton freeButton interactable"
        >Select…</ChoiceControl>}
    </SelectionFieldFrame> : selectedValues;
    return <Box ref={fieldRef} className={props.className} sx={{ minWidth: 0 }}>
        {style === CMSelectDisplayStyle.CustomButtonWithDialog ? props.customRender?.(openDialog)
            : showAll ? choices : selectedDisplay}
        {showAll && <SelectionQueryStatus query={query} />}
        {open && !props.readonly && <SelectionPicker source={props.source} value={props.value} multiple={props.multiple}
            title={props.dialogTitle || (props.multiple ? "Select options" : "Select an option")} description={props.dialogDescription}
            allowQuickFilter={props.allowQuickFilter} onCancel={() => setOpen(false)} onOptionsChanged={query.refetch}
            onAccept={value => { props.onChange(value); setOpen(false); }} />}
    </Box>;
}
