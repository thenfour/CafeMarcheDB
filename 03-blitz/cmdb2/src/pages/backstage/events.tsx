import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Alert, Button, ButtonGroup, Chip } from "@mui/material";
import { EventAttendanceResponseInput } from "src/core/components/CMComponents";
import CheckIcon from '@mui/icons-material/Check';
import PlaceIcon from '@mui/icons-material/Place';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import EditIcon from '@mui/icons-material/Edit';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbsUpDownIcon from '@mui/icons-material/ThumbsUpDown';
// effectively there are a couple variants of an "event":
// x 1. grid row, for admins
// x 2. card view, for pretty display on home page. not actionable
// x 3. summary view, on events page to give an overview of the status, musicians, attendees, files, etc.
// - 4. detail view, on its own page, for giving full information
// - 5. EDIT view

// let's think also about status. "confirmed" has always been a confusing thing.
// - "new": exists
// - "waiting for agreement" approvals: waiting for some
// - "waiting for musicians" approved or no approval needed
// - musicians: waiting for some
// - "It will happen!" enough musicians - requires another manual step
// - "Happening now"
// - "Done"
// - "Cancelled"

// approvals - there need to be multiple approvals.
// 1. agreement to pursue the event
// 2. 

// rehearsals are also events but have different defaults. no approvals etc.

// const Event = () => {
//     return <div className="contentSection">
//         <h1>Esperanzah 2023</h1>
//         <Alert severity="error">
//             <h1>Are you coming to <a href="#">Esperanzah 2023</a>?</h1>
//             {/* <Link>View event details...</Link> */}
//             <EventAttendanceResponseInput />
//         </Alert>
//     </div>;
// };


const Event2 = () => {
    return <div className="contentSection">
        <div className="sectionTitle">
            <Button className="topLine">
                <div className="titleText">Esperanzah 2023</div>
                <div className="statusIndicator confirmed">
                    <CheckIcon className="statusIcon" />
                    <span className="statusText">Confirmed</span>
                </div>
                <div className="seeMoreButtonContainer">
                    <a href="#">
                        <ArrowRightAltIcon />
                    </a>
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
                        <div className="name">You, Guido & Peter agree</div>
                        <div className="smallIconButton">
                            <EditIcon />
                        </div>
                    </div>
                </div>
            </div>{/* approvalSummaryLine */}


            <div className="approvalSummaryLine">
                <div className="approvalItem noResponse">
                    {/* <div className="responseChip">
                        <HelpOutlineIcon className="icon" />
                        <div className="name">Carl</div>
                    </div> */}
                    <div className="inputContainer">
                        <div className="prompt">Do we have enough musicians?</div>
                        <ButtonGroup className="approvalButtonGroup">
                            <Button endIcon={<CheckCircleOutlineIcon className="icon" />} className="yes">yes</Button>
                            <Button endIcon={<HighlightOffIcon />} className="no">no</Button>
                            <Button className="null">no answer</Button>
                        </ButtonGroup>
                    </div>
                </div>
                <div className="approvalItem approved">
                    <div className="responseChip">
                        <CheckCircleOutlineIcon className="icon" />
                        <div className="name">Peter</div>
                    </div>
                </div>

            </div>{/* approvalSummaryLine */}

            <EventAttendanceResponseInput />

        </div>
        <SettingMarkdown settingName="event_description_mockup_markdown"></SettingMarkdown>
        <div className="seeMoreButtonContainer">
            <Button className="seeMoreButton">
                <div>14 musicians going</div>
                <div>18 photos, 1 tech rider, 2 recordings have been uploaded</div>
                Click to see details...
            </Button></div>
    </div>;
};


const MainContent = () => {
    if (!useAuthorization("events page", Permission.view_events)) {
        throw new Error(`unauthorized`);
    }
    return (
        <div className="eventsMainContent">
            <SettingMarkdown settingName="events_markdown"></SettingMarkdown>
            <Event2 />
        </div>
    )
};

const ViewEventsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Events">
            <MainContent />
        </DashboardLayout>
    )
}

export default ViewEventsPage;
