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

export interface EventAttendanceResponseInputProps {
    finalized: boolean;
    past: boolean;
};

export const EventAttendanceResponseInput = (props: EventAttendanceResponseInputProps) => {

    return <div className="attendanceResponseInput">
        <div className="segmentList">
            <div className="segment">
                <div className="segmentName">Saturday (23 Sept 14-16u)</div>
                {/* <ButtonGroup size="small"> */}
                {/* <Button endIcon={<ThumbUpIcon />} className="yes notSelected">yep!</Button>
          <Button endIcon={<ThumbUpIcon />} className="yes_maybe notSelected">probably</Button> */}
                {/* <Button variant="text" endIcon={<ThumbDownIcon />} className="no_maybe selected">probably not</Button> */}
                {/* <Button endIcon={<ThumbDownIcon />} className="no notSelected">nope</Button> */}
                {/* </ButtonGroup> */}
                <div className="selectedValue yes_maybe">
                    <div className="textWithIcon">
                        <ThumbUpIcon className="icon" />
                        <span className="text">You are probably going</span>
                        {!props.past && <Button startIcon={<EditIcon />}></Button>}
                    </div>
                    {/* <div className="flexVerticalCenter">
                        <div className="placeholderText">
                            <EditIcon className="icon" />
                            <span>Add a comment...</span>
                        </div>
                    </div> */}
                </div>
            </div>
            <div className="segment">
                <div className="segmentName">Sunday (24 Sept 14-16u)</div>
                {props.finalized ? <>
                    <div className="selectedValue yes_maybe">
                        <div className="textWithIcon">
                            <ThumbUpIcon className="icon" />
                            <span className="text">You are probably going</span>
                            {!props.past && <Button startIcon={<EditIcon />}></Button>}
                        </div>
                    </div>
                </> : <>
                    <div className="prompt">Are you going?</div>
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

            {props.asArnold && <>
                <div className="approvalSummaryLine weaker">
                    {/* <div className="approvalItem approved">
                    <div className="responseChip">
                        <CheckCircleOutlineIcon className="icon" />
                        <div className="name">Carl agrees</div>
                        <div className="smallIconButton">
                            <EditIcon />
                        </div>
                    </div>
                </div> */}
                    <div className="approvalItem approved">
                        <div className="responseChip">
                            <CheckCircleOutlineIcon className="icon" />
                            <CheckCircleOutlineIcon className="icon" />
                            <CheckCircleOutlineIcon className="icon" />
                            <div className="name">You, Guido & Peter have agreed to this event</div>
                            <div className="smallIconButton">
                                <EditIcon />
                            </div>
                        </div>
                    </div>
                </div>{/* approvalSummaryLine */}


                <div className="approvalSummaryLine">
                    {props.finalized && <div className="approvalItem noResponse">
                        {/* <div className="responseChip">
                        <HelpOutlineIcon className="icon" />
                        <div className="name">Carl</div>
                    </div> */}
                        <div className="inputContainer">
                            <div className="prompt">Do we have enough musicians; are we OK for final confirmation?</div>
                            <ButtonGroup className="approvalButtonGroup">
                                <Button endIcon={<CheckCircleOutlineIcon className="icon" />} className="yes">yes</Button>
                                <Button endIcon={<HighlightOffIcon />} className="no">no</Button>
                                <Button className="null">no answer</Button>
                            </ButtonGroup>
                        </div>
                    </div>}
                    <div className="approvalItem approved">
                        <div className="responseChip">
                            <CheckCircleOutlineIcon className="icon" />
                            <div className="name">Peter</div>
                        </div>
                    </div>

                </div>{/* approvalSummaryLine */}
            </>
            }
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


