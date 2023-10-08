
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import React, { FC, Suspense } from "react"
import { ColorPaletteEntry } from 'shared/color';
import { ColorVariationOptions, GetStyleVariablesForColor } from './Color';
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { Button, Card, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useMediaQuery } from "@mui/material";
import { TAnyModel } from "shared/utils";
import { useTheme } from "@mui/material/styles";
import { CMTextField } from "./CMTextField";
import dynamic from 'next/dynamic'
import { gIconMap } from "../db3/components/IconSelectDialog";
const DynamicReactJson = dynamic(import('react-json-view'), { ssr: false });

// a white surface elevated from the gray base background, allowing vertical content.
// meant to be the ONLY surface
export const CMSinglePageSurfaceCard = (props: React.PropsWithChildren) => {
    return <Card className='singlePageSurface'>{props.children}</Card>;
};



////////////////////////////////////////////////////////////////
// rethinking "variant"... for component coloring variations, there are
// strong / weak
// selected / notselected
// disabled / enabled
// (hover)
// (focus)

// but it means having a lot of color variations:
// - main / contrast
// - faded main / contrast, for disabled/enabled
// - for selected, something else? maybe we're OK as is

export interface CMChipProps {
    color?: ColorPaletteEntry | string | null;
    variant?: ColorVariationOptions;
    selected?: boolean;
    disabled?: boolean;
    size?: "small" | "big";

    onDelete?: () => void;
    onClick?: () => void;
};

export const CMChip = (props: React.PropsWithChildren<CMChipProps>) => {
    const style = GetStyleVariablesForColor(props.color);
    const variant: ColorVariationOptions = props.variant || "strong";
    const size = props.size || "big";

    // .applyColor-strong-notselected-disabled
    const applyColorClass = `applyColor-${variant}-${props.selected ? "selected" : "notselected"}-${props.disabled ? "disabled" : "enabled"}`;

    const wrapperClasses: string[] = [
        "CMChip",
        size,
        variant,
        props.disabled ? "disabled" : "enabled",
        props.selected ? "selected" : "notselected",
        (props.onClick || props.onDelete) ? "interactable" : "noninteractable",
        //applyColorClass,
    ];

    const chipClasses: string[] = [
        "chipMain",
        size,
        variant,
        props.disabled ? "disabled" : "enabled",
        props.selected ? "selected" : "notselected",
        applyColorClass,
    ];

    return <div className={wrapperClasses.join(" ")} style={style} onClick={props.onClick}>
        <div className={chipClasses.join(" ")}>
            <div className='content'>
                {props.children}
            </div>
        </div>
    </div>;
}

export const CMChipContainer = (props: React.PropsWithChildren<{}>) => {
    return <div className="CMChipContainer">{props.children}</div>
}

// big chip is for the "you are coming!" big status badges which are meant to be a response to user input / interactive or at least suggesting interactivity / actionability.
export interface CMBigChipProps {
    color: ColorPaletteEntry | string | null | undefined;
    variant: ColorVariationOptions;
    // put icons & text in children
};

export const CMBigChip = (props: React.PropsWithChildren<CMBigChipProps>) => {
    const style = GetStyleVariablesForColor(props.color);
    return <div className={`cmbigchip ${props.variant}`} style={style}><div className='content'>
        {props.children}
    </div></div>;
};

////////////////////////////////////////////////////////////////
// little tag chip
export interface ITagAssociation {
    id: number;
};

export interface CMTagProps<TagAssignmentModel> {
    tagAssociation: ITagAssociation;
    columnSchema: db3.TagsField<unknown>,
    colorVariant: ColorVariationOptions;
};

export const CMTag = (props: CMTagProps<TAnyModel>) => {
    return DB3Client.DefaultRenderAsChip({
        value: props.tagAssociation,
        colorVariant: props.colorVariant,
        columnSchema: props.columnSchema,
        // onclick
        // ondelete
    });
};

export interface CMTagListProps<TagAssignmentModel> {
    tagAssociations: ITagAssociation[],
    columnSchema: db3.TagsField<unknown>,
    colorVariant: ColorVariationOptions;
};


export const CMTagList = (props: CMTagListProps<TAnyModel>) => {
    //console.log(props.tagAssociations);
    return <div className="chipContainer">
        {props.tagAssociations.map(tagAssociation => <CMTag
            key={tagAssociation.id}
            tagAssociation={tagAssociation}
            columnSchema={props.columnSchema}
            //tagsFieldClient={props.tagsFieldClient}
            colorVariant={props.colorVariant}
        />)}
    </div>
};


////////////////////////////////////////////////////////////////
// wraps <Dialog> except with mobile responsiveness
export interface ReactiveInputDialogProps {
    onCancel: () => void;
};
export const ReactiveInputDialog = (props: React.PropsWithChildren<ReactiveInputDialogProps>) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    return (
        <Dialog
            open={true}
            onClose={props.onCancel}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <Suspense>
                {props.children}
            </Suspense>
        </Dialog>
    );
};



////////////////////////////////////////////////////////////////
export interface EditTextFieldProps {
    value: string;
    onChange: (value: string) => void;
    columnSpec: db3.FieldBase<string>;
};
export const EditTextField = (props: EditTextFieldProps) => {
    const validationResult = props.columnSpec.ValidateAndParse({
        mode: "update",
        value: props.value,
        row: { [props.columnSpec.member]: props.value }
    });
    return <CMTextField
        autoFocus={true}
        onChange={(e, value) => { props.onChange(value) }}
        validationError={validationResult.errorMessage || null}
        value={props.value}
    />;
};


////////////////////////////////////////////////////////////////
// similar to ChooseItemDialog, we want little text fields to be editable
// on profile.tsx, values are editable inline.
// this one pops up a dialog, the point is
// 1. debouncing not necessary
// 2. on a very busy screen (edit details), a popup is more focused.
//
// this is just the dialog
export interface EditTextDialogProps {
    value: string;
    columnSpec: db3.FieldBase<string>;
    title: string;
    onOK: (value: string) => void;
    onCancel: () => void;
    renderDescription: () => React.ReactElement;
};
export const EditTextDialog = (props: EditTextDialogProps) => {
    const [value, setValue] = React.useState<string>(props.value);
    return <ReactiveInputDialog
        onCancel={props.onCancel}
    >
        <DialogTitle>
            {props.title}
        </DialogTitle>
        <DialogContent dividers>
            <DialogContentText>
                {props.renderDescription()}
            </DialogContentText>
            <EditTextField
                columnSpec={props.columnSpec}
                onChange={(newValue) => { setValue(newValue) }}
                value={value}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel}>Cancel</Button>
            <Button onClick={() => { props.onOK(value) }}>OK</Button>
        </DialogActions>
    </ReactiveInputDialog>;
};



////////////////////////////////////////////////////////////////
// this control is a button which pops up a dialog.
export interface EditTextDialogButtonProps {
    value: string;
    readOnly: boolean;
    columnSpec: db3.FieldBase<string>;
    selectButtonLabel: string;
    onChange: (value: string) => void;
    dialogTitle: string;
    renderDialogDescription: () => React.ReactElement;
};
export const EditTextDialogButton = (props: EditTextDialogButtonProps) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);

    return <>
        <Button disabled={props.readOnly} onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.selectButtonLabel}</Button>
        {isOpen && !props.readOnly && <EditTextDialog
            value={props.value}
            columnSpec={props.columnSpec}
            title={props.dialogTitle}
            renderDescription={props.renderDialogDescription}
            onOK={(newValue: string) => {
                props.onChange(newValue);
                setIsOpen(false);
            }}
            onCancel={() => {
                setIsOpen(false);
            }}
        />
        }
    </>;
};






////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface ConfirmationDialogProps {
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    title?: () => React.ReactElement | string;
    description?: () => React.ReactElement | string;
};
export const ConfirmationDialog = (props: ConfirmationDialogProps) => {
    return <ReactiveInputDialog
        onCancel={props.onCancel}
    >
        <DialogTitle>
            {props.title === undefined ? "Confirm?" : ((typeof props.title === 'string' ? props.title : props.title()))}
        </DialogTitle>
        <DialogContent dividers>
            {/* <DialogContentText> */}
            {(props.description !== undefined) && ((typeof props.description === 'string' ? props.description : props.description()))}
            {/* </DialogContentText> */}
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel}>{props.cancelLabel || "Cancel"}</Button>
            <Button onClick={props.onConfirm}>{props.confirmLabel || "OK"}</Button>
        </DialogActions>
    </ReactiveInputDialog>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////


export const InspectObject = (props: { src: any }) => {
    const [open, setOpen] = React.useState<boolean>(false);
    return <>
        <div className='debugInspectorOpen' onClick={() => setOpen(true)}>{gIconMap.Visibility()}</div>
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            <DynamicReactJson src={props.src} />
        </ReactiveInputDialog>}
    </>;
};
