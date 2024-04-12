
import { FormControlLabel, Switch } from "@mui/material";
import React from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { API, HomepageAgendaItemSpec } from '../db3/clientAPI';
import { gIconMap } from "../db3/components/IconSelectDialog";
import { EditTextDialogButton } from "./CMCoreComponents";
import { AgendaItem } from './homepageComponents';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { useAuthenticatedSession } from "@blitzjs/auth";


interface FrontpageControlSpec {
    fieldName: string;
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

    const handleChange = (newValue: string | null) => {
        console.log(`setting field ${props.fieldSpec.fieldName} to ${newValue}`);
        mutationToken.invoke({
            eventId: props.event.id,
            [props.fieldSpec.fieldName]: newValue,
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
    const value = props.event[props.fieldSpec.fieldName];
    const isNull = value === null;

    const handleNullChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // switching from null to not null.
            handleChange(defaultValue);
            return;
        }
        handleChange(null);
    }

    const canEdit = db3.xEvent.authorizeColumnForEdit({
        clientIntention,
        publicData,
        model: props.event,
        columnName: props.fieldSpec.fieldName,
    });

    const readonly = props.readonly || !canEdit;

    return <div className={`fieldContainer ${props.fieldSpec.fieldName} ${props.event.frontpageVisible ? "" : "faded"}`}>

        <div className='label'>
            <div className='text'>{props.fieldSpec.fieldLabel}</div>
            <div className='icon'>{props.fieldSpec.renderIcon()}</div>
        </div>
        <div className='nullContainer'>
            {props.fieldSpec.nullable &&
                <>
                    <Switch size="small" checked={!isNull} onChange={readonly ? undefined : handleNullChange} disabled={readonly} />
                    {isNull && <div className="autoLabel">(auto)</div>}
                </>
            }</div>
        <div className='editButtonContainer'>
            {!readonly && <EditTextDialogButton
                columnSpec={db3.xEvent.getColumn(props.fieldSpec.fieldName)! as db3.FieldBase<string>}
                dialogTitle={props.fieldSpec.fieldLabel}
                readOnly={readonly}
                dialogDescription={<>description here</>}
                selectButtonLabel='edit'
                value={value || defaultValue}
                onChange={handleChange}
            />}
        </div>
        <div className={`value ${isNull ? "faded" : ""}`}>{value || defaultValue}</div>
    </div>;
};






////////////////////////////////////////////////////////////////
export interface EventFrontpageTabContentProps {
    event: db3.EventClientPayload_Verbose;
    refetch: () => void;
    readonly: boolean;
};

export const EventFrontpageTabContent = (props: EventFrontpageTabContentProps) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

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

    const agendaItem: HomepageAgendaItemSpec = API.events.getAgendaItem(props.event);
    const fallbackValues = API.events.getAgendaItemFallbackValues(props.event);

    const canEdit_frontpageVisible = db3.xEvent.authorizeColumnForEdit({
        clientIntention,
        publicData,
        columnName: "frontpageVisible",
        model: props.event,
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

                {!API.users.isPublic(props.event) && <div className="warning CMSidenote">This event still won't be visible, because it has restricted visibility</div>}

            </div>
            <div className='editButtonContainer'>
            </div>
        </div>

        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.date || ""}
            fieldSpec={{
                fieldLabel: "Date",
                fieldName: "frontpageDate",
                nullable: false,
                renderIcon: gIconMap.CalendarMonth,
            }} />

        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.time || ""}
            fieldSpec={{
                fieldLabel: "Time",
                fieldName: "frontpageTime",
                nullable: false,
                renderIcon: gIconMap.Schedule,
            }} />

        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.title || ""}
            fieldSpec={{
                fieldLabel: "Title",
                fieldName: "frontpageTitle",
                nullable: true,
                renderIcon: gIconMap.Comment,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.detailsMarkdown || ""}
            fieldSpec={{
                fieldLabel: "Details",
                fieldName: "frontpageDetails",
                nullable: false,
                renderIcon: gIconMap.Comment,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.location || ""}
            fieldSpec={{
                fieldLabel: "Location",
                fieldName: "frontpageLocation",
                nullable: true,
                renderIcon: gIconMap.Place,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.locationURI || ""}
            fieldSpec={{
                fieldLabel: "Location URI",
                fieldName: "frontpageLocationURI",
                nullable: true,
                renderIcon: gIconMap.Link,
            }} />


        <EventFrontpageControl event={props.event} refetch={props.refetch} readonly={props.readonly}
            fallbackValue={fallbackValues.tags || ""}
            fieldSpec={{
                fieldLabel: "Tags",
                fieldName: "frontpageTags",
                nullable: true,
                renderIcon: gIconMap.Tag,
            }} />


        {props.event.frontpageVisible &&
            <div className='frontpageAgendaPreviewContainer'>
                <div className='previewCaption'>Preview</div>
                <div className="frontpageAgendaContent backstagePreview">
                    <AgendaItem item={agendaItem} />
                </div>
            </div>

        }
    </div>;
};

// frontpageDate: args.frontpageDate,
