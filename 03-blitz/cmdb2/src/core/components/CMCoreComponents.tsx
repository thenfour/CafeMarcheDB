
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import React, { FC, Suspense } from "react"
import { ColorPaletteEntry } from 'shared/color';
import { ColorVariationOptions, GetStyleVariablesForColor } from './Color';
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { Button, Card, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Tooltip, useMediaQuery } from "@mui/material";
import { TAnyModel } from "shared/utils";
import { useTheme } from "@mui/material/styles";
import { CMTextField } from "./CMTextField";
import dynamic from 'next/dynamic'
import { API, APIQueryResult } from '../db3/clientAPI';
import { RenderMuiIcon, gIconMap } from "../db3/components/IconSelectDialog";
import { ChoiceEditCell } from "./ChooseItemDialog";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { Permission } from "shared/permissions";

const DynamicReactJson = dynamic(import('react-json-view'), { ssr: false });

////////////////////////////////////////////////////////////////

// a white surface elevated from the gray base background, allowing vertical content.
// meant to be the ONLY surface

// well tbh, it's hard to know whether to use this or what <EventDetail> uses...
// .contentSection seems more developed, with 
export const CMSinglePageSurfaceCard = (props: React.PropsWithChildren) => {
    // return <Card className='singlePageSurface'>{props.children}</Card>;
    return <div className="contentSection">{props.children}</div>;
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

export type CMChipSizeOptions = "small" | "big";

export interface CMChipProps {
    color?: ColorPaletteEntry | string | null;
    variant?: ColorVariationOptions;
    selected?: boolean;
    disabled?: boolean;
    size?: CMChipSizeOptions;
    className?: string;

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
    if (props.className) {
        wrapperClasses.push(props.className);
    }

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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const CMChipContainer = (props: React.PropsWithChildren<{}>) => {
    return <div className="CMChipContainer">{props.children}</div>
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMStandardDBChipModel {
    color?: null | string | ColorPaletteEntry;
    iconName?: string | null;
    text?: string | null;
}

export interface CMStandardDBChipProps<T> {
    model: T;
    getText?: (value: any) => string; // override the text getter
    variant?: ColorVariationOptions;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

export const CMStandardDBChip = <T extends CMStandardDBChipModel,>(props: CMStandardDBChipProps<T>) => {
    return <CMChip
        color={props.model.color}
        variant={props.variant}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
    >
        {RenderMuiIcon(props.model.iconName)}{props.getText ? props.getText(props.model) : props.model.text}
    </CMChip>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const CMStatusIndicator = <T extends CMStandardDBChipModel,>(props: CMStandardDBChipProps<T>) => {
    return <CMStandardDBChip {...props} className="CMStatusIndicator" />;
};



// export const CMStatusIndicator = (props: React.PropsWithChildren<CMStatusIndicatorProps>) => {
//     const style = GetStyleVariablesForColor(props.type?.color);
//     return <div className='eventTypeValue' style={style}>
//         {RenderMuiIcon(props.type?.iconName)}
//         {props.type == null ? "--" :
//             props.type.text}
//     </div>;
// };




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
    className?: string;
};
export const ReactiveInputDialog = (props: React.PropsWithChildren<ReactiveInputDialogProps>) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    return (
        <Dialog
            className={props.className}
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


export const InspectObject = (props: { src: any, tooltip?: string }) => {
    const [open, setOpen] = React.useState<boolean>(false);
    return <>
        <Tooltip title={props.tooltip || "Open object inspector"}>
            <div className='debugInspectorOpen' onClick={() => setOpen(true)}>{gIconMap.Visibility()}</div>
        </Tooltip>
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            <DynamicReactJson src={props.src} />
        </ReactiveInputDialog>}
    </>;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type VisibilityControlValue = (db3.PermissionPayload | null);

export interface VisibilityValueProps {
    permission: db3.PermissionPayload | null;
    variant: "minimal" | "verbose";
    onClick?: () => void;
};

export const VisibilityValue = ({ permission, variant, onClick }: VisibilityValueProps) => {
    const style = GetStyleVariablesForColor(permission?.color);
    const visInfo = API.users.getVisibilityInfo({ visiblePermission: permission });
    const classes: string[] = [
        "visibilityValue eventVisibilityValue",
        onClick ? "interactable" : "",
        variant,
        visInfo.className,
    ];

    let tooltipTitle = "Public visibility: Everyone can see this.";
    if (visInfo.isPublic) {
        //
    } else if (visInfo.isPrivate) {
        tooltipTitle = "Private visibility: Only you can see this. You'll have to change this in order for others to view.";
    } else {
        tooltipTitle = `Restricted visibility: This is visible only to members of ${permission!.name}`;
    }

    return <Tooltip title={tooltipTitle}><div className={classes.join(" ")} style={style} onClick={onClick}>
        {variant === "minimal" ? (
            permission === null ? <>{gIconMap.Lock()}</> : RenderMuiIcon(permission?.iconName)
        ) : (
            permission === null ? <>{gIconMap.Lock()} private</> : <>{RenderMuiIcon(permission.iconName)} {permission.name}</>
        )}
        {/*permission === null ? "(private)" : `${permission.name}-nam`*/}
    </div></Tooltip>;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface VisibilityControlProps {
    value: VisibilityControlValue;
    onChange: (value: VisibilityControlValue) => void;
};
export const VisibilityControl = (props: VisibilityControlProps) => {
    const permissions = API.users.getAllPermissions();
    const [currentUser] = useCurrentUser();
    const visibilityChoices = [null, ...(permissions.items as db3.PermissionPayload[]).filter(p => {
        return p.isVisibility && p.roles.some(r => r.roleId === currentUser?.roleId);
    })];

    // value type is PermissionPayload
    return <div className={`VisibilityControl`}>
        <ChoiceEditCell
            isEqual={(a: db3.PermissionPayload, b: db3.PermissionPayload) => a.id === b.id}
            items={visibilityChoices}
            readOnly={false} // todo!
            validationError={null}
            selectDialogTitle='select dialog title here'
            //selectButtonLabel='change visibility'
            value={props.value}
            renderDialogDescription={() => {
                return <>dialog description heree</>;
            }}
            renderAsListItem={(chprops, value: db3.PermissionPayload | null, selected: boolean) => {
                return <li {...chprops}>
                    <VisibilityValue permission={value} variant="verbose" /></li>;
            }}
            renderValue={(args) => {
                return <VisibilityValue permission={args.value} variant="minimal" onClick={args.handleEnterEdit} />;
            }}
            onChange={props.onChange}
        />
    </div>;
};



////////////////////////////////////////////////////////////////
interface TabPanelProps {
    children?: React.ReactNode;
    tabPanelID: string;
    index: number;
    value: number;
}

export function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, tabPanelID, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`${tabPanelID}-tabpanel-${index}`}
            aria-labelledby={`${tabPanelID}-tab-${index}`}
            {...other}
        >
            {value === index && (
                <>
                    {children}
                </>
            )}
        </div>
    );
}

export function TabA11yProps(tabPanelID: string, index: number) {
    return {
        id: `${tabPanelID}-tab-${index}`,
        'aria-controls': `${tabPanelID}-tabpanel-${index}`,
    };
}


////////////////////////////////////////////////////////////////
// do not create separate components for the various verbosities.
// it's tempting, because it would have advantages:
// - can optimize queries easier for more compact variations
// - can have simpler control over big gui variations instead of trying to make everything unified
//
// however, that has drawbacks:
// - the init code is a lot, and it would either need to be duplicated or pass a huge amount of data around. neither is nice
// - will allow a smoother transition between verbosities
export type EventDetailVerbosity = "compact" | "default" | "verbose";
