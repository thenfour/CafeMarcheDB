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
import { Button, ButtonGroup, Card, CardActionArea, Chip, Link } from "@mui/material";
import ErrorIcon from '@mui/icons-material/Error';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import React, { FC, Suspense } from "react"
import dayjs, { Dayjs } from "dayjs";
import { DateCalendar, PickersDay, PickersDayProps } from '@mui/x-date-pickers';
import { SettingMarkdown } from './SettingMarkdown';


export interface EventAttendanceResponseInputProps {
    finalized: boolean;
    past: boolean;
    segmentCount: number;
};

// user chip - meant as chips in a list / pool
// user label - meant as a de-emphasized caption with a link

// db objects get a few different display methods:
// - as chip, for compact tag-like display, very small interaction (click, delete)
// - as list item, for multi selection; no interaction just selection
// - as non-interactive card, pretty, for search results, front page gateway
// - as a summary with limited interaction (an event on the events page) - quick actions and ability to drill into...
// - detail page


export const EventAttendanceResponseInputPast = (props: EventAttendanceResponseInputProps) => {

    return <div className="attendanceResponseInput past">
        <div className="segmentList">
            <div className="segment">
                <div className='header'>
                    <div className="segmentName">Saturday (23 Sept 14-16u)</div>
                </div>
                <div className="selectedValue yes_maybe">
                    <div className="textWithIcon">
                        <ThumbUpIcon className="icon" />
                        <span className="text">You were there!</span>
                    </div>
                </div>
            </div>
            {props.segmentCount > 1 &&
                <div className={props.finalized ? "segment " : "segment alert"}>
                    {props.finalized ? <>
                        <div className='header'>
                            <div className="segmentName">Sunday (24 Sept 14-16u)</div>
                        </div>
                        <div className="selectedValue yes_maybe">
                            <div className="textWithIcon">
                                <ThumbUpIcon className="icon" />
                                <span className="text">You were there!</span>
                            </div>
                        </div>
                    </> : <>
                        <div className='header'>
                            <ErrorOutlineIcon className='icon' />
                            <div>
                                <div className="segmentName">Sunday (24 Sept 14-16u)</div>
                                <div className="prompt">Were you there?</div>
                            </div>
                        </div>
                        <ButtonGroup >
                            <Button endIcon={<ThumbUpIcon />} className="yes noSelection">yep!</Button>
                            <Button endIcon={<ThumbDownIcon />} className="no noSelection">nope</Button>
                            <Button className="null noSelection">no answer</Button>
                        </ButtonGroup>
                    </>}
                </div>
            }
        </div>
    </div>;
};


export const EventAttendanceResponseInput = (props: EventAttendanceResponseInputProps) => {
    if (props.past) return EventAttendanceResponseInputPast(props);
    return <div className="attendanceResponseInput future">
        <div className="segmentList">
            <div className="segment">
                <div className='header'>
                    <div className="segmentName">Saturday (23 Sept 14-16u)</div>
                </div>
                <div className="selectedValue yes_maybe">
                    <div className="textWithIcon">
                        <ThumbUpIcon className="icon" />
                        <span className="text">You are probably going</span>
                    </div>
                </div>
            </div>
            {props.segmentCount > 1 &&
                <div className={props.finalized ? "segment " : "segment alert"}>
                    {props.finalized ? <>
                        <div className='header'>
                            <div className="segmentName">Sunday (24 Sept 14-16u)</div>
                        </div>
                        <div className="selectedValue yes_maybe">
                            <div className="textWithIcon">
                                <ThumbUpIcon className="icon" />
                                <span className="text">You are probably going</span>

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
            }
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


export const MockupEventCard = () => {

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


export const MockupRehearsalCard = () => {

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
                    <div className="info">1 photo uploaded</div>
                    <div className="chipContainer">
                    </div>
                </div>
            </div>
        </CardActionArea>
    </Card>



};



export interface EventSummaryProps {
    asDirector: boolean;
    asArnold: boolean;
    finalized: boolean;
    past: boolean;
};

export const EventSummary = (props: EventSummaryProps) => {
    return <div className={`contentSection event concert ${props.past ? "past" : "future"}`}>

        <div className="infoLine">
            <div className="date smallInfoBox">
                <CalendarMonthIcon className="icon" />
                <span className="text">24 August 2023</span>
            </div>

            <div className="location smallInfoBox">
                <PlaceIcon className="icon" />
                <span className="text">24 lombardstraat, 1050 brussel</span>
            </div>

        </div>

        <div className='titleLine'>
            <Link href="/backstage/event/aoeu" className="titleLink">
                <div className="titleText">Esperanzah 2023</div>
            </Link>
            <div className="statusIndicator confirmed">
                <CheckIcon className="statusIcon" />
                <span className="statusText">Confirmed</span>
            </div>
        </div>

        <div className="tagsLine">
            <Chip size="small" label="concert" />
            <Chip size="small" label="majorettes" />
            <Chip size="small" label="festival" />
        </div>

        <EventAttendanceResponseInput finalized={props.finalized} past={props.past} segmentCount={2} />

        <SettingMarkdown settingName="event_description_mockup_markdown"></SettingMarkdown>
        <div className="seeMoreButtonContainer">
            <Button className="seeMoreButton">
                {/* <div>14 musicians going</div> */}
                {/* <div>18 photos, 1 tech rider, 2 recordings have been uploaded</div> */}
                Click to see details...
            </Button></div>
    </div >;
};



export const RehearsalSummary = (props: EventSummaryProps) => {
    return <div className={`contentSection event rehearsal ${props.past ? "past" : "future"}`}>

        <div className="infoLine">
            <div className="date smallInfoBox">
                <CalendarMonthIcon className="icon" />
                <span className="text">24 August 2023</span>
            </div>

            <div className="location smallInfoBox">
                <PlaceIcon className="icon" />
                <span className="text">24 lombardstraat, 1050 brussel</span>
            </div>

        </div>

        <div className='titleLine'>
            <Link href="/backstage/event/aoeu" className="titleLink">
                <div className="titleText">rehearsal</div>
            </Link>
            <div className="statusIndicator confirmed">
                <CheckIcon className="statusIcon" />
                <span className="statusText">Confirmed</span>
            </div>
        </div>

        <div className="tagsLine">
        </div>

        <EventAttendanceResponseInput finalized={props.finalized} past={props.past} segmentCount={1} />

        <div className='songListLine'>
            <ol>
                <li>Uma Compania</li>
                <li>Early Bird</li>
                <li>Pour Pour</li>
                <li>In The Mood</li>
                <li>Musique Mechanique</li>
                <li>Uma Compania</li>
            </ol>
        </div>

        <div className="seeMoreButtonContainer">
            <Button className="seeMoreButton">
                {/* <div>14 musicians going</div> */}
                {/* <div>18 photos, 1 tech rider, 2 recordings have been uploaded</div> */}
                Click to see details...
            </Button></div>
    </div>;
};


export const EventDetail = () => {
    return <div className={`contentSection event future`}>

        <div className="infoLine">
            <div className="date smallInfoBox">
                <CalendarMonthIcon className="icon" />
                <span className="text">24 August 2023</span>
            </div>

            <div className="location smallInfoBox">
                <PlaceIcon className="icon" />
                <span className="text">24 lombardstraat, 1050 brussel</span>
            </div>

        </div>

        <div className='titleLine'>
            <Link href="/backstage/event/aoeu" className="titleLink">
                <div className="titleText">rehearsal</div>
            </Link>
            <div className="statusIndicator confirmed">
                <CheckIcon className="statusIcon" />
                <span className="statusText">Confirmed</span>
            </div>
        </div>

        <div className="tagsLine">
        </div>

        <EventAttendanceResponseInput finalized={false} past={false} segmentCount={1} />

        <div className='songListLine'>
            <div className='caption'>Set list #1</div>
            <ol className='list'>
                <li>Uma Compania</li>
                <li>Early Bird</li>
                <li>Pour Pour</li>
                <li>In The Mood</li>
                <li>Musique Mechanique</li>
                <li>Uma Compania</li>
                <li>+ add song</li>
            </ol>
        </div>

        <table className='attendanceTable'>
            <caption>
                Who's coming?
            </caption>
            <thead>
            </thead>
            <tbody>
                <tr>
                    <th>Name</th>
                    <th>Instrument</th>
                    <th>Function</th>
                    <th>Saturday</th>
                    <th>Sunday</th>
                </tr>
                <tr>
                    <td>Carl</td>
                    <td>Flute, bass ++</td>
                    <td>Flute</td>
                    <td>
                        <div className="attendanceResponseChip yes_maybe">
                            <ThumbUpIcon className="icon" />
                            <span className="responseText">
                                probably going
                            </span>
                            <div className='userComment'>depends on a meeting at work</div>
                        </div>
                    </td>
                    <td>
                        <div className="attendanceResponseChip yes_maybe">
                            <ThumbUpIcon className="icon" />
                            <span className="responseText">
                                probably going
                            </span>
                            <div className='userComment'></div>
                        </div>
                    </td>

                </tr>
                <tr>
                    <td>Vincent</td>
                    <td>Trumpet</td>
                    <td>Trumpet</td>
                    <td>
                        <div className="attendanceResponseChip no">
                            <ThumbUpIcon className="icon" />
                            <span className="responseText">
                                not going
                            </span>
                            <div className='userComment'></div>
                        </div>
                    </td>
                    <td>
                        <div className="attendanceResponseChip no">
                            <ThumbUpIcon className="icon" />
                            <span className="responseText">
                                not going
                            </span>
                            <div className='userComment'></div>
                        </div>
                    </td>

                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <td>26</td>
                    <td></td>
                    <td></td>
                    <td>7 going, 12 not</td>
                    <td>7 going, 12 not</td>
                </tr>

            </tfoot>
        </table>


        <table className='viability'>
            <tbody>
                <tr>
                    <th>Function</th>
                    <th>going</th>
                    <th>not going</th>
                    <th>no answer</th>
                </tr>
                <tr>

                    <td>Flute</td>
                    <td>3</td>
                    <td>1</td>
                    <td>1</td>
                </tr>
            </tbody>
        </table>


        {/* 
        <div className='attendanceDetailGrid'>
            <div className='row header'>
                <div className='cell name'>Name</div>
                <div className='cell instrument'>Instrument</div>
                <div className='cell function'>Function</div>
                <div className='cell response'>Response</div>
            </div>
            <div className='row'>
                <div className='cell name'>Carl</div>
                <div className='cell instrument'>Flute, bass ++</div>
                <div className='cell function'>Flute</div>
                <div className='cell response'>
                    <div className="attendanceResponseChip yes_maybe">
                        <ThumbUpIcon className="icon" />
                        <span className="responseText">
                            probably going
                        </span>
                        <div className='userComment'>depends on a meeting at work</div>
                    </div>

                </div>
            </div>
        </div> */}

    </div>;
};


// interface CustomPickerDayProps extends PickersDayProps<Dayjs> {
//     dayIsBetween: boolean;
//     isFirstDay: boolean;
//     isLastDay: boolean;
// }

// function Day(props: PickersDayProps<Dayjs> & { selectedDay?: Dayjs | null }) {
//     const { day, selectedDay, ...other } = props;

//     // empty default stuff
//     // if (selectedDay == null) {
//     //     return <PickersDay style={{ backgroundColor: "#eff" }} day={day} {...other} />;
//     // }
//     if ((selectedDay != null) && (selectedDay.valueOf() === day.valueOf())) {
//         // selected day
//         return <PickersDay className='selected' day={day} {...other} />;
//     }

//     if (Math.random() < 0.05) {
//         return <PickersDay className='event' day={day} {...other} />;
//     }

//     return <PickersDay className='day' day={day} {...other} />;
// }


// export const EventCalendarMonth = () => {
//     const [value, setValue] = React.useState<Dayjs | null>(dayjs('2022-04-17'));
//     return <DateCalendar
//         defaultValue={dayjs('2022-04-17')} views={['day']}
//         value={value}
//         onChange={(newValue) => setValue(newValue)}
//         slots={{ day: Day }}
//         slotProps={{
//             day: {
//                 selectedDay: value,
//             } as any,
//         }}
//     />;
// };
