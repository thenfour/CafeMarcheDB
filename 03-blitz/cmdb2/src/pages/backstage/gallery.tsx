import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization, useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Alert, Button, ButtonGroup, Chip, Divider } from "@mui/material";
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
import * as CMCoreComponents from "src/core/components/CMCoreComponents";
import * as db3 from "src/core/db3/db3";
import { StandardVariationSpec, gGeneralPaletteList } from "shared/color";
import { IconEditCell } from "src/core/db3/components/IconSelectDialog";
import { DateTimeRangeControlExample } from "src/core/components/DateTimeRangeControl";

const MainContent = () => {

    useAuthorizationOrThrow("gallyery", Permission.sysadmin);

    return <>
        <Divider />
        <h2>CMCoreComponents</h2>

        <h3>CMSinglePageSurfaceCard</h3>
        <div>for elevating content on a page, or just use .contentSection / .header / .content</div>
        <CMCoreComponents.CMSinglePageSurfaceCard>
            <div className="header">CMSinglePageSurfaceCard.header</div>
            <div className="content">CMSinglePageSurfaceCard.content</div>
        </CMCoreComponents.CMSinglePageSurfaceCard>

        <h3>CMBigChip</h3>
        <div>colored chip that can contain a lot of stuff (not like a small chip like a single TAG), used by attendance options</div>
        <CMCoreComponents.CMBigChip color={"yes"} variation={StandardVariationSpec.Strong} >
            <ThumbUpIcon />
            <div>CMCoreComponents.CMBigChip</div>
        </CMCoreComponents.CMBigChip>

        <Divider />

        <h3>CMChip</h3>
        <CMCoreComponents.CMChipContainer>
            <CMCoreComponents.CMChip color={"yes"} size="small" variation={{ enabled: false, selected: false, fillOption: "filled", variation: "strong" }}>(todo: all variations)</CMCoreComponents.CMChip>
        </CMCoreComponents.CMChipContainer>



        <h3>CMChip on surface </h3>
        <CMCoreComponents.CMSinglePageSurfaceCard>
            <CMCoreComponents.CMChipContainer>
                <CMCoreComponents.CMChip color={"yes"} size="small" variation={{ enabled: false, selected: false, fillOption: "filled", variation: "strong" }}>(todo: all variations)</CMCoreComponents.CMChip>
            </CMCoreComponents.CMChipContainer>
        </CMCoreComponents.CMSinglePageSurfaceCard>


        <h3>Icons</h3>
        <div>
            <IconEditCell validationError={null} onOK={() => { }} value={null} readonly={false} />
        </div>


        <h3>DateTimeRange</h3>
        <div>
            <DateTimeRangeControlExample />
        </div>

    </>;
};

const ComponentGalleryPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Component Gallery">
            <MainContent />
        </DashboardLayout>
    )
}

export default ComponentGalleryPage;
