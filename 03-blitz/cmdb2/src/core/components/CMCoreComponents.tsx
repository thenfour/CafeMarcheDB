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
import { Button, ButtonGroup, Card, CardActionArea, Chip, Link } from "@mui/material";
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
    tableClient: DB3Client.xTableRenderClient,
};

export const CMEventAttendanceSummaryBigChip = (props: CMEventAttendanceSummaryBigChipProps) => {
    const user = useCurrentUser()!;
    console.assert(!!user);

    const eventInfo = new db3.EventInfoForUser({ event: props.event, userId: user.id });
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
                if (!seg.response) {
                    return <CMBigChip key={index} color={null} variant="weak">
                        <QuestionMarkIcon />
                        no response yet
                    </CMBigChip>;
                } else {
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
    tableClient: DB3Client.xTableRenderClient,
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
    tagsFieldClient: DB3Client.TagsFieldClient<TagAssignmentModel>,
    colorVariant: ColorVariationOptions;
};

export const CMTag = (props: CMTagProps<TAnyModel>) => {
    return props.tagsFieldClient.defaultRenderAsChip({
        value: props.tagAssociation,
        colorVariant: props.colorVariant,
    });
};

export interface CMTagListProps<TagAssignmentModel> {
    tagAssociations: ITagAssociation[],
    tagsFieldClient: DB3Client.TagsFieldClient<TagAssignmentModel>,
    colorVariant: ColorVariationOptions;
};


export const CMTagList = (props: CMTagListProps<TAnyModel>) => {
    //console.log(props.tagAssociations);
    return <div className="chipContainer">
        {props.tagAssociations.map(tagAssociation => <CMTag key={tagAssociation.id} tagAssociation={tagAssociation} tagsFieldClient={props.tagsFieldClient} colorVariant={props.colorVariant} />)}
    </div>
};


////////////////////////////////////////////////////////////////
// non-interactive-feeling card; it's meant as a gateway to something else with very little very curated information.
export interface NoninteractiveCardEventProps {
    event: db3.EventPayloadClient,
    tableClient: DB3Client.xTableRenderClient,
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

                    <CMEventBigStatus event={props.event} tableClient={props.tableClient} />
                    {/* 
                    <CMBigChip color={sampleColor} variant='strong'>
                        <ThumbUpIcon />
                        You are coming!
                    </CMBigChip> */}

                    <CMEventAttendanceSummaryBigChip event={props.event} tableClient={props.tableClient} />
                    {/* 
                    <div className="attendance yes">
                        <div className="chip">
                        </div>
                    </div> */}

                    {/* <div className="info">43 photos uploaded</div> */}
                    <CMTagList
                        tagAssociations={props.event.tags}
                        tagsFieldClient={props.tableClient.args.tableSpec.getColumn("tags") as DB3Client.TagsFieldClient<db3.EventTagAssignmentModel>}
                        colorVariant="weak"
                    />
                </div>
            </div>
        </CardActionArea>
    </Card>
};


// for "events page"; a sort of page surface but intended for multiple items on a page.
// each surface should generally not take up much vertical space, so it's clear that there's more content.
// export const CMMultiPageSurface = (props: React.PropsWithChildren) => {

// };

// static concert card
// static event card

