
import { Button, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch } from "@mui/material";
import React from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { Prisma } from "db";
import { API, HomepageAgendaItemSpec } from '../db3/clientAPI';
import { AgendaItem } from './homepageComponents';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { useAuthenticatedSession } from "@blitzjs/auth";
import { SettingMarkdown } from "./SettingMarkdown";
import { DashboardContext } from "./DashboardContext";
import { EventEnrichedVerbose_Event } from "./EventComponentsBase";
import { gIconMap } from "../db3/components/IconMap";
import { CMDialogContentText, CMSmallButton, KeyValueTable } from "./CMCoreComponents2";
import { CMChip, CMChipContainer } from "./CMChip";
import { EnNlFr, IsNullOrWhitespace } from "shared/utils";
import { EditTextField, ReactiveInputDialog } from "./CMCoreComponents";




////////////////////////////////////////////////////////////////
// similar to ChooseItemDialog, we want little text fields to be editable
// on profile.tsx, values are editable inline.
// this one pops up a dialog, the point is
// 1. debouncing not necessary
// 2. on a very busy screen (edit details), a popup is more focused.
//
// this is just the dialog
export interface EditTextDialogProps {
    title: string;
    onOK: (valueEn: string, valueNl: string, valueFr: string) => void;
    onCancel: () => void;
    description: React.ReactNode;
    clientIntention: db3.xTableClientUsageContext

    valueEn: string;
    columnSpecEn: db3.FieldBase<string>;
    valueNl: string;
    columnSpecNl: db3.FieldBase<string>;
    valueFr: string;
    columnSpecFr: db3.FieldBase<string>;
};
export const EditTextDialog = (props: EditTextDialogProps) => {
    const [valueEn, setValueEn] = React.useState<string>(props.valueEn);
    const [valueNl, setValueNl] = React.useState<string>(props.valueNl);
    const [valueFr, setValueFr] = React.useState<string>(props.valueFr);
    return <ReactiveInputDialog
        onCancel={props.onCancel}
    >
        <DialogTitle>
            {props.title}
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                {props.description}
            </CMDialogContentText>
            <h3>EN</h3>
            <EditTextField
                columnSpec={props.columnSpecEn}
                clientIntention={props.clientIntention}
                onChange={(newValue) => { setValueEn(newValue) }}
                value={valueEn}
            />
            <h3>NL</h3>
            <EditTextField
                columnSpec={props.columnSpecNl}
                clientIntention={props.clientIntention}
                onChange={(newValue) => { setValueNl(newValue) }}
                value={valueNl}
            />
            <h3>FR</h3>
            <EditTextField
                columnSpec={props.columnSpecFr}
                clientIntention={props.clientIntention}
                onChange={(newValue) => { setValueFr(newValue) }}
                value={valueFr}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel}>Cancel</Button>
            <Button onClick={() => { props.onOK(valueEn, valueNl, valueFr) }}>OK</Button>
        </DialogActions>
    </ReactiveInputDialog>;
};



////////////////////////////////////////////////////////////////
// this control is a button which pops up a dialog.
// by default JUST displays the button (not the text)
export interface EditTextDialogButtonProps {
    valueEn: string;
    columnSpecEn: db3.FieldBase<string>;
    valueNl: string;
    columnSpecNl: db3.FieldBase<string>;
    valueFr: string;
    columnSpecFr: db3.FieldBase<string>;

    readOnly: boolean;
    selectButtonLabel: string;
    onChange: (valueEn: string, valueNl: string, valueFr: string) => void;
    dialogTitle: string;
    dialogDescription: React.ReactNode;
    clientIntention: db3.xTableClientUsageContext
};
export const EditTextDialogButton = (props: EditTextDialogButtonProps) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);

    return <>
        <Button disabled={props.readOnly} onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.selectButtonLabel}</Button>
        {isOpen && !props.readOnly && <EditTextDialog
            valueEn={props.valueEn}
            columnSpecEn={props.columnSpecEn}
            valueNl={props.valueNl}
            columnSpecNl={props.columnSpecNl}
            valueFr={props.valueFr}
            columnSpecFr={props.columnSpecFr}
            clientIntention={props.clientIntention}
            title={props.dialogTitle}
            description={props.dialogDescription}
            onOK={(valueEn: string, valueNl: string, valueFr: string) => {
                props.onChange(valueEn, valueNl, valueFr);
                setIsOpen(false);
            }}
            onCancel={() => {
                setIsOpen(false);
            }}
        />
        }
    </>;
};




////////////////////////////////////////////////////////////////
interface FrontpageControlSpec {
    fieldNameEn: keyof Prisma.EventGetPayload<{
        select: {
            frontpageDate: true,
            frontpageTime: true,
            frontpageDetails: true,
            frontpageTitle: true,
            frontpageLocation: true,
            frontpageLocationURI: true,
            frontpageTags: true,
        }
    }>;
    fieldNameNl: keyof Prisma.EventGetPayload<{
        select: {
            frontpageDate_nl: true,
            frontpageTime_nl: true,
            frontpageDetails_nl: true,
            frontpageTitle_nl: true,
            frontpageLocation_nl: true,
            frontpageLocationURI_nl: true,
            frontpageTags_nl: true,
        }
    }>;
    fieldNameFr: keyof Prisma.EventGetPayload<{
        select: {
            frontpageDate_fr: true,
            frontpageTime_fr: true,
            frontpageDetails_fr: true,
            frontpageTitle_fr: true,
            frontpageLocation_fr: true,
            frontpageLocationURI_fr: true,
            frontpageTags_fr: true,
        }
    }>;
    nullable: boolean;
    fieldLabel: string;
    renderIcon: () => JSX.Element;
}

interface EventFrontpageControlProps {
    event: db3.EventWithStatusPayload;
    refetch: () => void;
    fieldSpec: FrontpageControlSpec;
    fallbackValue: string;
    readonly: boolean;
};







////////////////////////////////////////////////////////////////
export const EventFrontpageControl = (props: EventFrontpageControlProps) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const handleChange = (valueEn: string | null, valueNl: string | null, valueFr: string | null) => {
        mutationToken.invoke({
            eventId: props.event.id,
            [props.fieldSpec.fieldNameEn]: valueEn,
            [props.fieldSpec.fieldNameNl]: valueNl,
            [props.fieldSpec.fieldNameFr]: valueFr,
        }).then(() => {
            showSnackbar({ severity: "success", children: `Successfully updated ${props.fieldSpec.fieldLabel}` });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating event date ${props.fieldSpec.fieldLabel}` });
        }).finally(() => {
            props.refetch();
        });
    };

    const defaultValue = props.fallbackValue;
    const valueEn = props.event[props.fieldSpec.fieldNameEn];
    const valueNl = props.event[props.fieldSpec.fieldNameNl];
    const valueFr = props.event[props.fieldSpec.fieldNameFr];
    const isNull = valueEn === null;

    const canEdit = db3.xEvent.authorizeColumnForEdit({
        clientIntention,
        publicData,
        model: props.event,
        columnName: props.fieldSpec.fieldNameEn, // assume same perms for all languages
        fallbackOwnerId: null,
    });

    const readonly = props.readonly || !canEdit;

    return <div className={`fieldContainer ${props.fieldSpec.fieldNameEn /* assumes this is the "plain" fieldname with out lang suffix */} ${props.event.frontpageVisible ? "" : "faded"}`}>

        <div className='label'>
            <div className='text'>{props.fieldSpec.fieldLabel}</div>
        </div>
        <div className='editButtonContainer'>
            {!readonly && <div style={{ display: "flex", flexDirection: "column", width: "100px" }}><EditTextDialogButton
                clientIntention={clientIntention}
                columnSpecEn={db3.xEvent.getColumn(props.fieldSpec.fieldNameEn)! as db3.FieldBase<string>}
                valueEn={valueEn || defaultValue}
                columnSpecNl={db3.xEvent.getColumn(props.fieldSpec.fieldNameNl)! as db3.FieldBase<string>}
                valueNl={valueNl || ""}
                columnSpecFr={db3.xEvent.getColumn(props.fieldSpec.fieldNameFr)! as db3.FieldBase<string>}
                valueFr={valueFr || ""}
                dialogTitle={props.fieldSpec.fieldLabel}
                readOnly={readonly}
                dialogDescription={<SettingMarkdown setting={`EventFrontpageEditDialog_${props.fieldSpec.fieldLabel}` as any} />}
                selectButtonLabel='edit'
                onChange={handleChange}
            />
                {!IsNullOrWhitespace(defaultValue) && <Button onClick={() => {
                    handleChange(defaultValue, null, null);
                }}>Reset</Button>}
            </div>}
        </div>
        <KeyValueTable className={`value`} data={{
            EN: valueEn || defaultValue,
            NL: valueNl || "",
            FR: valueFr || "",
        }} />
    </div>;
};
















////////////////////////////////////////////////////////////////
export interface EventFrontpageTabContentProps {
    event: EventEnrichedVerbose_Event;
    refetch: () => void;
    readonly: boolean;
};

export const EventFrontpageTabContent = (props: EventFrontpageTabContentProps) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const [previewLang, setPreviewLang] = React.useState<EnNlFr>("en");
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };
    const dashboardContext = React.useContext(DashboardContext);

    const handleVisibilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        mutationToken.invoke({
            eventId: props.event.id,
            frontpageVisible: e.target.checked,
        }).then(() => {
            showSnackbar({ severity: "success", children: `Successfully updated frontpage visibility` });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating event date frontpage visibility` });
        }).finally(() => {
            props.refetch();
        });
    }

    const agendaItem: HomepageAgendaItemSpec = API.events.getAgendaItem(props.event, previewLang);
    const fallbackValues = API.events.getAgendaItemFallbackValues(props.event, previewLang);

    const canEdit_frontpageVisible = db3.xEvent.authorizeColumnForEdit({
        clientIntention,
        publicData,
        columnName: "frontpageVisible",
        model: props.event,
        fallbackOwnerId: null,
    });

    return <div className='EventFrontpageTabContent'>
        <div className={`fieldContainer frontpageVisible`}>
            <div className='label'>
            </div>
            <div className='nullContainer'>
            </div>
            <div className={`value frontpageVisible`}>
                <FormControlLabel
                    className='CMFormControlLabel'
                    // NB: readonly does not work for <Switch>.
                    control={
                        <Switch size="small" checked={props.event.frontpageVisible} disabled={props.readonly || !canEdit_frontpageVisible} onChange={props.readonly ? undefined : handleVisibilityChange} />
                    }
                    label="Show this event on the front page?"
                />

                {!dashboardContext.isPublic(props.event) && <div className="warning CMSidenote">This event still won't be visible, because it has restricted visibility</div>}

            </div>
            <div className='editButtonContainer'>
            </div>
        </div>

        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.date || ""}
            fieldSpec={{
                fieldLabel: "Date",
                fieldNameEn: "frontpageDate",
                fieldNameFr: "frontpageDate_fr",
                fieldNameNl: "frontpageDate_nl",
                nullable: false,
                renderIcon: gIconMap.CalendarMonth,
            }} />

        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.time || ""}
            fieldSpec={{
                fieldLabel: "Time",
                fieldNameEn: "frontpageTime",
                fieldNameFr: "frontpageTime_fr",
                fieldNameNl: "frontpageTime_nl",
                nullable: false,
                renderIcon: gIconMap.Schedule,
            }} />

        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.title || ""}
            fieldSpec={{
                fieldLabel: "Title",
                fieldNameEn: "frontpageTitle",
                fieldNameFr: "frontpageTitle_fr",
                fieldNameNl: "frontpageTitle_nl",
                nullable: true,
                renderIcon: gIconMap.Comment,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.detailsMarkdown || ""}
            fieldSpec={{
                fieldLabel: "Details",
                fieldNameEn: "frontpageDetails",
                fieldNameFr: "frontpageDetails_fr",
                fieldNameNl: "frontpageDetails_nl",
                nullable: false,
                renderIcon: gIconMap.Comment,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.location || ""}
            fieldSpec={{
                fieldLabel: "Location",
                fieldNameEn: "frontpageLocation",
                fieldNameFr: "frontpageLocation_fr",
                fieldNameNl: "frontpageLocation_nl",
                nullable: true,
                renderIcon: gIconMap.Place,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.locationURI || ""}
            fieldSpec={{
                fieldLabel: "Location URI",
                fieldNameEn: "frontpageLocationURI",
                fieldNameFr: "frontpageLocationURI_fr",
                fieldNameNl: "frontpageLocationURI_nl",
                nullable: true,
                renderIcon: gIconMap.Link,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.tags || ""}
            fieldSpec={{
                fieldLabel: "Tags",
                fieldNameEn: "frontpageTags",
                fieldNameFr: "frontpageTags_fr",
                fieldNameNl: "frontpageTags_nl",
                nullable: true,
                renderIcon: gIconMap.Tag,
            }} />


        {props.event.frontpageVisible &&
            <div className='frontpageAgendaPreviewContainer'>
                <div className='previewCaptionRow'>
                    <CMChipContainer className="langToolbar">
                        <div className="title">Preview</div>
                        <CMChip onClick={() => setPreviewLang("en")} size="small" shape="rectangle" variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: previewLang === "en" }}>EN</CMChip>
                        <CMChip onClick={() => setPreviewLang("nl")} size="small" shape="rectangle" variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: previewLang === "nl" }}>NL</CMChip>
                        <CMChip onClick={() => setPreviewLang("fr")} size="small" shape="rectangle" variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: previewLang === "fr" }}>FR</CMChip>
                    </CMChipContainer>
                </div>
                <div className="frontpageAgendaContent backstagePreview">
                    <AgendaItem item={agendaItem} />
                </div>
            </div>

        }
    </div>;
};

// frontpageDate: args.frontpageDate,
