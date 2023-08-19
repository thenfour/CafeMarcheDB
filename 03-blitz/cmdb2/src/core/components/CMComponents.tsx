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
import { Button, ButtonGroup, Card, CardActionArea, Chip } from "@mui/material";
import ErrorIcon from '@mui/icons-material/Error';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import React, { FC, Suspense } from "react"
import dayjs, { Dayjs } from "dayjs";
import { DateCalendar, PickersDay, PickersDayProps } from '@mui/x-date-pickers';


export interface EventAttendanceResponseInputProps {
    finalized: boolean;
    past: boolean;
};

export const EventAttendanceResponseInput = (props: EventAttendanceResponseInputProps) => {

    return <div className="attendanceResponseInput">
        <div className="segmentList">
            <div className="segment">
                <div className='header'>
                    <div className="segmentName">Saturday (23 Sept 14-16u)</div>
                </div>
                <div className="selectedValue yes_maybe">
                    <div className="textWithIcon">
                        <ThumbUpIcon className="icon" />
                        <span className="text">You are probably going</span>
                        {!props.past && <Button startIcon={<EditIcon />}></Button>}
                    </div>
                </div>
            </div>
            <div className={props.finalized ? "segment " : "segment alert"}>
                {props.finalized ? <>
                    <div className='header'>
                        <div className="segmentName">Sunday (24 Sept 14-16u)</div>
                    </div>
                    <div className="selectedValue yes_maybe">
                        <div className="textWithIcon">
                            <ThumbUpIcon className="icon" />
                            <span className="text">You are probably going</span>
                            {!props.past && <Button startIcon={<EditIcon />}></Button>}
                        </div>
                    </div>
                </> : <>
                    <div className='header'>
                        <ErrorOutlineIcon className='icon' />
                        <div>
                            <div className="segmentName">Sunday (24 Sept 14-16u)</div>
                            <div className="prompt">Are you going?</div>
                        </div>
                    </div>
                    <ButtonGroup >
                        <Button endIcon={<ThumbUpIcon />} className="yes noSelection">yep!</Button>
                        <Button endIcon={<ThumbUpIcon />} className="yes_maybe noSelection">probably</Button>
                        <Button endIcon={<ThumbDownIcon />} className="no_maybe noSelection">probably not</Button>
                        <Button endIcon={<ThumbDownIcon />} className="no noSelection">nope</Button>
                        <Button className="null noSelection">no answer</Button>
                    </ButtonGroup>
                </>}
            </div>
        </div>
    </div>;
};


export const EventAttendanceResponseInput2 = () => {

    return <div className="attendanceResponseInput">
        <div className="segmentList">
            <div className="segment">
                <div className="segmentName">Saturday (23 Sept 14-16u)</div>
                <div className="selectedValue yes_maybe">
                    <div className="textWithIcon">
                        <ThumbUpIcon className="icon" />
                        <span className="text">You are probably going</span>
                        <Button startIcon={<EditIcon />}></Button>
                    </div>
                </div>
            </div>
        </div>
    </div>;
};


export const EventCard = () => {

    const maxRotation = 2;
    const rotate = `${((Math.random() * maxRotation)) - (maxRotation * .5)}deg`;
    const maxMargin = 30;
    const marginLeft = `${(Math.random() * maxMargin) + 25}px`;

    return <Card className="cmcard concert" elevation={5} style={{ rotate, marginLeft }}>
        <CardActionArea className="actionArea">
            <div className="cardContent">
                <div className="left"><div className="leftVertText">2023</div></div>
                <div className="image"></div>
                <div className="hcontent">
                    <div className="date">23-26 June 2023</div>
                    <div className="name">Esperanzah! 2023</div>
                    <div className="status confirmed">
                        <CheckIcon />
                        Confirmed
                    </div>
                    <div className="attendance yes">
                        <div className="chip">
                            <ThumbUpIcon />
                            You are coming!
                        </div>
                    </div>
                    <div className="info">43 photos uploaded</div>
                    <div className="chipContainer">
                        <Chip className="chip" size="small" label={"Majorettes snths nth "} />
                        <Chip className="chip" size="small" label={"Festival"} />
                        <Chip className="chip" size="small" label={"Concert"} />
                    </div>
                </div>
            </div>
        </CardActionArea>
    </Card>
};


export const RehearsalCard = () => {

    const maxRotation = 2;
    const rotate = `${((Math.random() * maxRotation)) - (maxRotation * .5)}deg`;
    const maxMargin = 30;
    const marginLeft = `${(Math.random() * maxMargin) + 25}px`;

    return <Card className="cmcard rehearsal" elevation={5} style={{ rotate, marginLeft }}>
        <CardActionArea className="actionArea">
            <div className="cardContent">
                <div className="left"><div className="leftVertText">2023</div></div>
                <div className="image"></div>
                <div className="hcontent">
                    <div className="date">17 August 2023</div>
                    <div className="name">Rehearsal</div>
                    <div className="info">Recording available!</div>
                    <div className="chipContainer">
                    </div>
                </div>
            </div>
        </CardActionArea>
    </Card>



};



export interface EventDetailProps {
    asDirector: boolean;
    asArnold: boolean;
    finalized: boolean;
    past: boolean;
};

export const EventDetail = (props: EventDetailProps) => {
    return <div className="contentSection">
        <div className="sectionTitle">
            <Button className="topLine">
                <div className="titleText">Esperanzah 2023</div>
                <div className="statusIndicator confirmed">
                    <CheckIcon className="statusIcon" />
                    <span className="statusText">Confirmed</span>
                </div>
            </Button>

            <div className="infoLine">
                <div className="date smallInfoBox">
                    <CalendarMonthIcon className="icon" />
                    <span className="text">24 August 2023</span>
                </div>

                <div className="location smallInfoBox">
                    <PlaceIcon className="icon" />
                    <span className="text">24 lombardstraat, 1050 brussel</span>
                </div>

                <div className="titleTagsContainer">
                    <Chip size="small" label="concert" />
                    <Chip size="small" label="majorettes" />
                    <Chip size="small" label="festival" />
                </div>
            </div>

            <EventAttendanceResponseInput finalized={props.finalized} past={props.past} />

        </div>
        {/* <SettingMarkdown settingName="event_description_mockup_markdown"></SettingMarkdown> */}
        <div className="seeMoreButtonContainer">
            <Button className="seeMoreButton">
                <div>14 musicians going</div>
                {/* <div>18 photos, 1 tech rider, 2 recordings have been uploaded</div> */}
                Click to see details...
            </Button></div>
    </div>;
};



interface CustomPickerDayProps extends PickersDayProps<Dayjs> {
    dayIsBetween: boolean;
    isFirstDay: boolean;
    isLastDay: boolean;
}

function Day(props: PickersDayProps<Dayjs> & { selectedDay?: Dayjs | null }) {
    const { day, selectedDay, ...other } = props;

    // empty default stuff
    // if (selectedDay == null) {
    //     return <PickersDay style={{ backgroundColor: "#eff" }} day={day} {...other} />;
    // }
    if ((selectedDay != null) && (selectedDay.valueOf() === day.valueOf())) {
        // selected day
        return <PickersDay className='selected' day={day} {...other} />;
    }

    if (Math.random() < 0.05) {
        return <PickersDay className='event' day={day} {...other} />;
    }

    return <PickersDay className='day' day={day} {...other} />;
}


export const EventCalendarMonth = () => {
    const [value, setValue] = React.useState<Dayjs | null>(dayjs('2022-04-17'));
    return <DateCalendar
        defaultValue={dayjs('2022-04-17')} views={['day']}
        value={value}
        onChange={(newValue) => setValue(newValue)}
        slots={{ day: Day }}
        slotProps={{
            day: {
                selectedDay: value,
            } as any,
        }}
    />;
};
