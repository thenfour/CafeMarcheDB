import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Alert, Button, ButtonGroup, Chip } from "@mui/material";
import { EventAttendanceResponseInput, EventAttendanceResponseInput2, EventSummary, RehearsalSummary } from "src/core/components/CMMockupComponents";
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

// NO approvals, because
// 1. it clogs up the GUI
// 2. only 3 people use it, and requires everyone to be diligent
// 3. adoption uncertain
// 4. small impact overall
// therefore: too much investment

/// there's a problem with showing calendars.
// while it does show a cool overview, interactivity is a problem.
// 1. how many months? each month is very awkward on screen space.
// 2. interactivity? you can't actually display any info per-day, so interactivity is important but then it massively complicates things.
// therefore: no calendars for the moment.

const MainContent = () => {
    if (!useAuthorization("events page", Permission.view_events)) {
        throw new Error(`unauthorized`);
    }
    const style: React.CSSProperties = {
        border: "2px solid blue",
        height: "100px",
        backgroundColor: "red",
        position: "sticky",
        top: 0,
    };
    return (<>
        <div className="stickyControls" style={style}>
        </div>
        <div className="eventsMainContent">

            <SettingMarkdown settingName="events_markdown"></SettingMarkdown>

            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <EventSummary asArnold={true} asDirector={true} finalized={true} past={true} />
            <EventSummary asArnold={false} asDirector={false} finalized={false} past={true} />
            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <EventSummary asArnold={false} asDirector={false} finalized={true} past={true} />

            <EventSummary asArnold={true} asDirector={false} finalized={true} past={false} />
            <EventSummary asArnold={true} asDirector={true} finalized={true} past={false} />
            <EventSummary asArnold={false} asDirector={false} finalized={false} past={false} />
            <EventSummary asArnold={false} asDirector={false} finalized={true} past={false} />
        </div>
    </>
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
