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
import { Alert, Breadcrumbs, Button, ButtonGroup, Card, CardActionArea, Chip, Link, TextField, Tooltip, Typography } from "@mui/material";
import React, { FC, Suspense } from "react"
import dayjs, { Dayjs } from "dayjs";
import { DateCalendar, PickersDay, PickersDayProps } from '@mui/x-date-pickers';
import { CompactMutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
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
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { CMTextField } from './CMTextField';
import { CompactMarkdownControl, Markdown, MarkdownControl } from './RichTextEditor';
import { CMBigChip, CMTagList } from './CMCoreComponents';
import HomeIcon from '@mui/icons-material/Home';
import { EventAttendanceAnswer, EventAttendanceSummary } from './EventAttendanceComponents';

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
    const [user] = useCurrentUser();
    if (!user || !user.id) throw new Error(`no current user`);

    return <Card className="cmcard event concert" elevation={5} >
        <CardActionArea className="actionArea" href={API.events.getURIForEvent(props.event)}>
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

                    <EventAttendanceSummary event={props.event} />

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
export const EventBreadcrumbs = () => {
    return <Breadcrumbs aria-label="breadcrumb">
        <Link
            underline="hover"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center' }}
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </Link>
        <Link
            underline="hover"
            color="inherit"
            href="/backstage/events"
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            Events
        </Link>
    </Breadcrumbs>
        ;
};
