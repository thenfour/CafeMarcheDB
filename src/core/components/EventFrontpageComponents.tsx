
import { useAuthenticatedSession } from "@blitzjs/auth";
import { Button, DialogContent, DialogTitle, FormControlLabel, Switch } from "@mui/material";
import { Prisma } from "db";
import React from "react";
import { EnNlFr, LangSelectStringWithDetail } from "shared/lang";
import { DateTimeRange } from "shared/time";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { API, HomepageAgendaItemSpec } from '../db3/clientAPI';
import { gIconMap } from "../db3/components/IconMap";
import { CMChip, CMChipContainer } from "./CMChip";
import { EditTextField } from "./CMCoreComponents";
import { CMDialogContentText, DialogActionsCM } from "./CMCoreComponents2";
import { useConfirm } from "./ConfirmationDialog";
import { DashboardContext } from "./DashboardContext";
import { EventEnrichedVerbose_Event } from "./EventComponentsBase";
import { AgendaItem } from './homepageComponents';
import { ReactiveInputDialog } from "./ReactiveInputDialog";
import { SettingMarkdown } from "./SettingMarkdown";




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
            <DialogActionsCM>
                <Button onClick={props.onCancel}>Cancel</Button>
                <Button onClick={() => { props.onOK(valueEn, valueNl, valueFr) }}>OK</Button>
            </DialogActionsCM>
        </DialogContent>
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
    readonly: boolean;
    getResetValues?: () => { en: string, nl: string, fr: string };
};




const EventFrontpageValuesTable = ({ valueEn, valueNl, valueFr }: { valueEn: string, valueNl: string, valueFr: string }) => {

    const renderValueOrFallback = (lang: EnNlFr): React.ReactNode => {
        const selectResult = LangSelectStringWithDetail(lang, valueEn, valueNl, valueFr);
        if (selectResult.preferredLangWasChosen) {
            return <span>{selectResult.result}</span>;
        }
        return <span className="faded">{selectResult.result}</span>;
    };

    return <table className="EventFrontpageValuesTable value">
        <tbody>
            <tr><th>EN</th><td>{renderValueOrFallback("en")}</td></tr>
            <tr><th>NL</th><td>{renderValueOrFallback("nl")}</td></tr>
            <tr><th>FR</th><td>{renderValueOrFallback("fr")}</td></tr>
        </tbody>
    </table>;

};


////////////////////////////////////////////////////////////////
export const EventFrontpageControl = (props: EventFrontpageControlProps) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const user = useCurrentUser()[0]!;
    const confirm = useConfirm();
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

    const valueEn = props.event[props.fieldSpec.fieldNameEn] || "";
    const valueNl = props.event[props.fieldSpec.fieldNameNl] || "";
    const valueFr = props.event[props.fieldSpec.fieldNameFr] || "";

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
            {!readonly && <div style={{ display: "flex", flexDirection: "column", width: "100px" }}>
                <EditTextDialogButton
                    clientIntention={clientIntention}
                    columnSpecEn={db3.xEvent.getColumn(props.fieldSpec.fieldNameEn)! as db3.FieldBase<string>}
                    valueEn={valueEn || ""}
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
                {props.getResetValues && <Button onClick={async () => {
                    const vals = props.getResetValues!();
                    const r = await confirm({
                        title: `Reset ${props.fieldSpec.fieldLabel} to auto values?`,
                        description: <EventFrontpageValuesTable valueEn={vals.en} valueFr={vals.fr} valueNl={vals.nl} />
                    });
                    if (r) {
                        handleChange(vals.en, vals.nl, vals.fr);
                    }
                }}>
                    Reset
                </Button>}
            </div>}
        </div>

        <EventFrontpageValuesTable valueEn={valueEn} valueFr={valueFr} valueNl={valueNl} />

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
    const confirm = useConfirm();
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

    const canEdit_frontpageVisible = db3.xEvent.authorizeColumnForEdit({
        clientIntention,
        publicData,
        columnName: "frontpageVisible",
        model: props.event,
        fallbackOwnerId: null,
    });

    let dateRange = new DateTimeRange({
        startsAtDateTime: props.event.startsAt,
        durationMillis: Number(props.event.durationMillis),
        isAllDay: props.event.isAllDay,
    });
    let dateTimeDisplayStrings = dateRange.toDisplayStrings();

    const dateResetter = () => ({
        en: dateTimeDisplayStrings.en.date,
        nl: dateTimeDisplayStrings.nl.date,
        fr: dateTimeDisplayStrings.fr.date,
    });
    const timeResetter = () => ({
        en: dateTimeDisplayStrings.en.time || "",
        nl: dateTimeDisplayStrings.nl.time || "",
        fr: dateTimeDisplayStrings.fr.time || "",
    });
    const titleResetter = () => ({ en: props.event.name, fr: "", nl: "" });
    const locationResetter = () => ({ en: props.event.locationDescription, fr: "", nl: "" });
    const tagsResetter = () => ({
        en: props.event.tags.filter(t => t.eventTag.visibleOnFrontpage).map(t => `#${t.eventTag.text}`).join(" "),
        fr: "",
        nl: "",
    });

    const resetAll = async () => {
        const dateValues = dateResetter();
        const timeValues = timeResetter();
        const titleValues = titleResetter();
        const locationValues = locationResetter();
        const tagsValues = tagsResetter();
        const y = await confirm({
            title: "Reset all fields to the following?",
            description: <>
                <h3>Date</h3>
                <EventFrontpageValuesTable valueEn={dateValues.en} valueFr={dateValues.fr} valueNl={dateValues.nl} />
                <h3>Time</h3>
                <EventFrontpageValuesTable valueEn={timeValues.en} valueFr={timeValues.fr} valueNl={timeValues.nl} />
                <h3>Title</h3>
                <EventFrontpageValuesTable valueEn={titleValues.en} valueFr={titleValues.fr} valueNl={titleValues.nl} />
                <h3>Location</h3>
                <EventFrontpageValuesTable valueEn={locationValues.en} valueFr={locationValues.fr} valueNl={locationValues.nl} />
                <h3>Tags</h3>
                <EventFrontpageValuesTable valueEn={tagsValues.en} valueFr={tagsValues.fr} valueNl={tagsValues.nl} />
            </>
        });
        if (y) {
            try {
                await mutationToken.invoke({
                    eventId: props.event.id,

                    frontpageDate: dateValues.en,
                    frontpageDate_fr: dateValues.fr,
                    frontpageDate_nl: dateValues.nl,

                    frontpageTime: timeValues.en,
                    frontpageTime_fr: timeValues.fr,
                    frontpageTime_nl: timeValues.nl,

                    frontpageTitle: titleValues.en,
                    frontpageTitle_fr: titleValues.fr,
                    frontpageTitle_nl: titleValues.nl,

                    frontpageLocation: locationValues.en,
                    frontpageLocation_fr: locationValues.fr,
                    frontpageLocation_nl: locationValues.nl,

                    frontpageTags: tagsValues.en,
                    frontpageTags_fr: tagsValues.fr,
                    frontpageTags_nl: tagsValues.nl,
                });
                showSnackbar({ severity: "success", children: `Success` });
            } catch (e) {
                console.log(e);
                showSnackbar({ severity: "error", children: `error` });
            } finally {
                props.refetch();
            };

        }
    };

    return <div className='EventFrontpageTabContent'>
        <div className={`fieldContainer frontpageVisible`}>
            <div className='label'>
            </div>
            <div className='nullContainer' style={{ alignItems: "flex-start" }}>
                <Button onClick={resetAll}>Reset all</Button>
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
            getResetValues={dateResetter}
            fieldSpec={{
                fieldLabel: "Date",
                fieldNameEn: "frontpageDate",
                fieldNameFr: "frontpageDate_fr",
                fieldNameNl: "frontpageDate_nl",
                nullable: false,
                renderIcon: gIconMap.CalendarMonth,
            }} />

        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            getResetValues={timeResetter}
            fieldSpec={{
                fieldLabel: "Time",
                fieldNameEn: "frontpageTime",
                fieldNameFr: "frontpageTime_fr",
                fieldNameNl: "frontpageTime_nl",
                nullable: false,
                renderIcon: gIconMap.Schedule,
            }} />

        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            getResetValues={titleResetter}
            fieldSpec={{
                fieldLabel: "Title",
                fieldNameEn: "frontpageTitle",
                fieldNameFr: "frontpageTitle_fr",
                fieldNameNl: "frontpageTitle_nl",
                nullable: true,
                renderIcon: gIconMap.Comment,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fieldSpec={{
                fieldLabel: "Details",
                fieldNameEn: "frontpageDetails",
                fieldNameFr: "frontpageDetails_fr",
                fieldNameNl: "frontpageDetails_nl",
                nullable: false,
                renderIcon: gIconMap.Comment,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            getResetValues={locationResetter}
            fieldSpec={{
                fieldLabel: "Location",
                fieldNameEn: "frontpageLocation",
                fieldNameFr: "frontpageLocation_fr",
                fieldNameNl: "frontpageLocation_nl",
                nullable: true,
                renderIcon: gIconMap.Place,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fieldSpec={{
                fieldLabel: "Location URI",
                fieldNameEn: "frontpageLocationURI",
                fieldNameFr: "frontpageLocationURI_fr",
                fieldNameNl: "frontpageLocationURI_nl",
                nullable: true,
                renderIcon: gIconMap.Link,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            getResetValues={tagsResetter}
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
