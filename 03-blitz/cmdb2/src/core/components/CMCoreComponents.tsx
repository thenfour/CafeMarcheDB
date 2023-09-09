// 


// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import {
    Edit as EditIcon
} from '@mui/icons-material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import PlaceIcon from '@mui/icons-material/Place';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ErrorIcon from '@mui/icons-material/Error';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Alert, Button, ButtonGroup, Card, CardActionArea, Chip, Link } from "@mui/material";
import React, { FC, Suspense } from "react"
import dayjs, { Dayjs } from "dayjs";
import { DateCalendar, PickersDay, PickersDayProps } from '@mui/x-date-pickers';
import { SettingMarkdown } from './SettingMarkdown';
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { ColorPaletteEntry, gGeneralPaletteList } from 'shared/color';
import { ColorVariationOptions, GetStyleVariablesForColor } from './Color';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { TAnyModel } from 'shared/utils';
import { RenderMuiIcon } from '../db3/components/IconSelectDialog';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import { API } from '../db3/clientAPI';
import { SnackbarContext } from "src/core/components/SnackbarContext";

// a white surface elevated from the gray base background, allowing vertical content.
// meant to be the ONLY surface
export const CMSinglePageSurface = (props: React.PropsWithChildren) => {
    return <div className='singlePageSurface'>{props.children}</div>;
};



////////////////////////////////////////////////////////////////
// big chip is for the "you are coming!" big status badges which are meant to be a response to user input / interactive or at least suggesting interactivity / actionability.
export interface CMBigChipProps {
    color: ColorPaletteEntry | string | null;
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
// specific big chip for event attendance summary
export interface CMEventAttendanceSummaryBigChipProps {
    event: db3.EventPayloadClient,
    //tableClient: DB3Client.xTableRenderClient,
};

export const CMEventAttendanceSummaryBigChip = (props: CMEventAttendanceSummaryBigChipProps) => {
    const user = useCurrentUser()!;
    console.assert(!!user);

    const eventInfo = new db3.EventInfoForUser({ event: props.event, user });
    console.assert(!!eventInfo.segments);

    // if all responses are the same, easy; display 1 big thing.
    // if all responses are NOT the same .... then display them all in compact form, one slot for each event segment

    // const segmentResponses = {}; // key = segment id, value=response or undefined
    // const distinctResponses = {}; // 
    // props.event.segments.forEach(seg => {
    //     const found = seg.responses.find(r => r.userId === user?.id);
    //     if (found) segmentResponses[seg.id] = found;
    // });

    //console.log(segmentResponses);

    return <div className='CMEventAttendanceSummary bigChipContainer'>
        {
            eventInfo.segments.map((seg, index) => {
                console.assert(!!seg.response);
                if (seg.response.expectAttendance && !seg.response.attendance) {
                    // no response but one is expected.
                    return <CMBigChip key={index} color={null} variant="weak">
                        <QuestionMarkIcon />
                        no response yet
                    </CMBigChip>;
                } else if (!seg.response.expectAttendance && !seg.response.attendance) {
                    // not expected & no response
                    return <CMBigChip key={index} color={null} variant="weak">
                        no response expected
                    </CMBigChip>;
                } else {
                    // there's a response, whether it's expected or not doesn't matter.
                    console.assert(!!seg.response.attendance);
                    const attendance = seg.response.attendance!;
                    return <CMBigChip key={index} color={attendance.color} variant="weak">
                        {(attendance.strength > 50) ?
                            <ThumbUpIcon /> : <ThumbDownIcon />
                        }
                        {attendance.personalText}
                    </CMBigChip>;
                }
            })
        }
    </div>;

    // const sampleColor = gGeneralPaletteList.findEntry("yes");

    // return <CMBigChip color={sampleColor} variant='strong'>
    //     <ThumbUpIcon />
    //     You are coming!
    // </CMBigChip>;
};


////////////////////////////////////////////////////////////////
// TODO: generic big status
////////////////////////////////////////////////////////////////
// specific non-interactive status for event status
export interface CMEventBigStatusProps {
    event: db3.EventPayloadClient,
    //tableClient: DB3Client.xTableRenderClient,
};

export const CMEventBigStatus = (props: CMEventBigStatusProps) => {
    if (!props.event.status) {
        return null;
    }
    const status: db3.EventStatusPayload = props.event.status;
    const style = GetStyleVariablesForColor(status.color);
    //console.log(status.color)
    return <div><div className={`bigstatus applyColor-inv`} style={style}>
        {RenderMuiIcon(status.iconName)}
        {status.label}
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
    //tagsFieldClient: DB3Client.TagsFieldClient<TagAssignmentModel>,
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
// non-interactive-feeling card; it's meant as a gateway to something else with very little very curated information.
export interface NoninteractiveCardEventProps {
    event: db3.EventPayloadClient,
    //tableClient: DB3Client.xTableRenderClient,
};

export const NoninteractiveCardEvent = (props: NoninteractiveCardEventProps) => {

    // the rotation is cool looking but maybe just too much
    // const maxRotation = 2;
    // const rotate = `${((Math.random() * maxRotation)) - (maxRotation * .5)}deg`;
    // const maxMargin = 30;
    // const marginLeft = `${(Math.random() * maxMargin) + 25}px`;
    // style={{ rotate, marginLeft }}

    // find your attendance record.
    const user = useCurrentUser();
    if (!user || !user.id) throw new Error(`no current user`);

    return <Card className="cmcard concert" elevation={5} >
        <CardActionArea className="actionArea">
            <div className="cardContent">
                <div className="left"><div className="leftVertText">{props.event.dateRangeInfo.formattedYear}</div></div>
                <div className="image"></div>
                <div className="hcontent">
                    <div className="date">{props.event.dateRangeInfo.formattedDateRange}</div>
                    <div className="name">{props.event.name}</div>

                    <CMEventBigStatus event={props.event} />
                    {/* 
                    <CMBigChip color={sampleColor} variant='strong'>
                        <ThumbUpIcon />
                        You are coming!
                    </CMBigChip> */}

                    <CMEventAttendanceSummaryBigChip event={props.event} />
                    {/* 
                    <div className="attendance yes">
                        <div className="chip">
                        </div>
                    </div> */}

                    {/* <div className="info">43 photos uploaded</div> */}
                    <CMTagList
                        tagAssociations={props.event.tags}
                        columnSchema={db3.xEvent.getColumn("tags") as db3.TagsField<db3.EventTagAssignmentModel>}
                        //tagsFieldClient={props.tableClient.args.tableSpec.getColumn("tags") as DB3Client.TagsFieldClient<db3.EventTagAssignmentModel>}
                        colorVariant="weak"
                    />
                </div>
            </div>
        </CardActionArea>
    </Card>
};



////////////////////////////////////////////////////////////////
// event segment attendance standalone field (read-only possible, buttons array for input).
// used on events page main and big alerts
export interface EventAttendanceResponseControlProps {
    value: db3.EventAttendanceBasePayload | null;
    onChange: (value: db3.EventAttendanceBasePayload | null) => void;
};

export const EventAttendanceResponseControl = (props: EventAttendanceResponseControlProps) => {
    const options = API.events.useGetEventAttendanceOptions({});
    const nullSelStyle = (!props.value) ? "selected" : "notSelected";
    return <ButtonGroup className='EventAttendanceResponseControlButtonGroup'>

        {options.items.map(option => {
            const style = GetStyleVariablesForColor(option.color);
            const selStyle = (!!props.value && (option.id === props.value.id)) ? "selected" : "notSelected";
            const yesNoStyle = (option.strength > 50) ? "yes" : "no";
            return <Button
                key={option.id}
                style={style}
                endIcon={(option.strength > 50) ? <ThumbUpIcon /> : <ThumbDownIcon />}
                className={`${yesNoStyle} applyColor-strong-noBorder ${selStyle}`}
                onClick={() => { props.onChange(option); }}
            >
                {option.text}
            </Button>;
        })}

        <Button className={`null noSelection ${nullSelStyle}`} onClick={() => { props.onChange(null); }}>no answer</Button>

    </ButtonGroup>;
};



////////////////////////////////////////////////////////////////
// event segment attendance standalone field (read-only possible, buttons array for input).
// used on events page main and big alerts
export interface EventSegmentAttendanceControlProps {
    event: db3.EventPayloadClient,
    segment: db3.EventSegmentPayloadFromEvent,
    userInfo: db3.EventInfoForUser,
    onRefetch: () => void,
    //tableClient: DB3Client.xTableRenderClient,
};

export const EventSegmentAttendanceControl = (props: EventSegmentAttendanceControlProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const token = API.events.updateUserEventSegmentAttendance.useToken();

    const handleOnChange = async (value: db3.EventAttendanceBasePayload | null) => {
        try {
            await API.events.updateUserEventSegmentAttendance.invoke(token, {
                userId: props.userInfo.user.id,
                eventSegmentId: props.segment.id,
                attendanceId: value == null ? null : value.id,
            }); //{
            //} props.segment.id, props.userInfo.user.id, value);
            showSnackbar({ severity: 'success', children: "update successful - todo: refetch" });
            props.onRefetch();
        } catch (e) {
            console.log(e);
            showSnackbar({ severity: 'error', children: "error;  see console" });
        }
    };

    return <div className={"segment alert"}>
        <div className='header'>
            <ErrorOutlineIcon className='icon' />
            <div>
                <div className="segmentName">{props.segment.name} {API.events.getEventSegmentFormattedDateRange(props.segment)}</div>
                <div className="prompt">Are you going?</div>
            </div>
        </div>
        <EventAttendanceResponseControl
            value={props.userInfo.getSegmentUserInfo(props.segment.id).response.attendance}
            onChange={handleOnChange}
        />
    </div>;

};



////////////////////////////////////////////////////////////////
export interface EventAttendanceAlertControlAnsweredSegmentProps {
    event: db3.EventPayloadClient,
    segment: db3.EventSegmentPayloadFromEvent,
    //tableClient: DB3Client.xTableRenderClient,
};

export const EventAttendanceAlertControlAnsweredSegment = (props: EventAttendanceAlertControlAnsweredSegmentProps) => {
    return <div className="segment ">
        <div className='header'>
            <div className="segmentName">{API.events.getEventSegmentFormattedDateRange(props.segment)}</div>
        </div>
        <div className="selectedValue yes_maybe">
            <div className="textWithIcon">
                <ThumbUpIcon className="icon" />
                <span className="text">You are probably going</span>
            </div>
        </div>
    </div>
};


////////////////////////////////////////////////////////////////
// big attendance alert (per event, multiple segments)
export interface EventAttendanceAlertControlProps {
    event: db3.EventPayloadClient,
    onRefetch: () => void,
};

export const EventAttendanceAlertControl = (props: EventAttendanceAlertControlProps) => {
    const user = useCurrentUser()!;
    const eventInfo = API.events.getEventInfoForUser({ event: props.event, user });
    return <Alert severity="error" className='cmalert attendanceAlert'>
        <h1>Are you coming to <a href="#">{props.event.name}</a>?</h1>
        <div className="attendanceResponseInput">
            <div className="segmentList">

                {props.event.segments.map(segment => {
                    // if answered,
                    const segInfo = eventInfo.getSegmentUserInfo(segment.id);
                    if (!!segInfo.response.attendance) {
                        return <EventAttendanceAlertControlAnsweredSegment key={segment.id} event={props.event} segment={segment} />;
                    } else {
                        return <EventSegmentAttendanceControl key={segment.id} event={props.event} segment={segment} userInfo={eventInfo} onRefetch={props.onRefetch} />;
                    }
                })}

            </div>
        </div>
    </Alert>;


};







// static concert card
// static event card
