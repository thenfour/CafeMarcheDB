import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
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
import { gGeneralPaletteList } from "shared/color";

const MainContent = () => {

    const MockUserInstruments = [{
        id: 1,
        name: "flute",
        description: "a description",
        color: "yes",
    }, {
        id: 2,
        name: "soprano saxophone",
        description: "antother description",
        color: "no",
    }];
    const MockAssociationSchema = {
        associationTableSpec: {
            getRowInfo: (row): db3.RowInfo => ({
                name: row.name,
                description: row.description,
                color: gGeneralPaletteList.findEntry(row.color),
            })
        }
    };

    return <>
        <Divider />
        <h2>CMCoreComponents</h2>

        <h3>CMSinglePageSurfaceCard</h3>
        <div>for elevating content on a page</div>
        <CMCoreComponents.CMSinglePageSurfaceCard>
            CMSinglePageSurfaceCard
        </CMCoreComponents.CMSinglePageSurfaceCard>

        <h3>CMBigChip</h3>
        <div>colored chip that can contain a lot of stuff (not like a small chip like a single TAG), used by attendance options</div>
        <CMCoreComponents.CMBigChip color={"yes"} variant="strong">
            <ThumbUpIcon />
            <div>CMCoreComponents.CMBigChip</div>
        </CMCoreComponents.CMBigChip>

        <h3>CMTag</h3>
        <div>renders a column value using a default chip render method.</div>
        <CMCoreComponents.CMTag colorVariant="strong" tagAssociation={MockUserInstruments[0] as any} columnSchema={MockAssociationSchema as any} />

        <h3>CMTagList</h3>
        <div></div>
        <CMCoreComponents.CMTagList colorVariant="strong" columnSchema={MockAssociationSchema as any} tagAssociations={MockUserInstruments as any} />


        <Divider />
        <h2>CMCoreComponents</h2>

        <h3>CMSinglePageSurfaceCard</h3>
        <div>for elevating content on a page</div>
        <CMCoreComponents.CMSinglePageSurfaceCard>
            CMSinglePageSurfaceCard
        </CMCoreComponents.CMSinglePageSurfaceCard>

        <h3>CMBigChip</h3>
        <div>colored chip that can contain a lot of stuff (not like a small chip like a single TAG), used by attendance options</div>
        <CMCoreComponents.CMBigChip color={"yes"} variant="strong">
            <ThumbUpIcon />
            <div>CMCoreComponents.CMBigChip</div>
        </CMCoreComponents.CMBigChip>

        <h3>CMTag</h3>
        <div>renders a column value using a default chip render method.</div>
        <CMCoreComponents.CMTag colorVariant="strong" tagAssociation={MockUserInstruments[0] as any} columnSchema={MockAssociationSchema as any} />

        <h3>CMTagList</h3>
        <div></div>
        <CMCoreComponents.CMTagList colorVariant="strong" columnSchema={MockAssociationSchema as any} tagAssociations={MockUserInstruments as any} />


        <h3>CMChip</h3>
        <CMCoreComponents.CMChipContainer>
            <CMCoreComponents.CMChip color={"yes"} size="small" disabled={false} selected={false} variant="strong">strong notselected enabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="small" disabled={false} selected={true} variant="strong">strong selected enabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="small" disabled={true} selected={false} variant="strong">strong notselected disabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="small" disabled={true} selected={true} variant="strong">strong selected disabled</CMCoreComponents.CMChip>
        </CMCoreComponents.CMChipContainer>
        <CMCoreComponents.CMChipContainer>
            <CMCoreComponents.CMChip color={"yes"} size="big" disabled={false} selected={false} variant="strong">strong notselected enabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="big" disabled={false} selected={true} variant="strong">strong selected enabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="big" disabled={true} selected={false} variant="strong">strong notselected disabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="big" disabled={true} selected={true} variant="strong">strong selected disabled</CMCoreComponents.CMChip>
        </CMCoreComponents.CMChipContainer>
        <CMCoreComponents.CMChipContainer>
            <CMCoreComponents.CMChip color={"yes"} size="small" disabled={false} selected={false} variant="weak">weak notselected enabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="small" disabled={false} selected={true} variant="weak">weak selected enabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="small" disabled={true} selected={false} variant="weak">weak notselected disabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="small" disabled={true} selected={true} variant="weak">weak selected disabled</CMCoreComponents.CMChip>
        </CMCoreComponents.CMChipContainer>
        <CMCoreComponents.CMChipContainer>
            <CMCoreComponents.CMChip color={"yes"} size="big" disabled={false} selected={false} variant="weak">weak notselected enabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="big" disabled={false} selected={true} variant="weak">weak selected enabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="big" disabled={true} selected={false} variant="weak">weak notselected disabled</CMCoreComponents.CMChip>
            <CMCoreComponents.CMChip color={"yes"} size="big" disabled={true} selected={true} variant="weak">weak selected disabled</CMCoreComponents.CMChip>
        </CMCoreComponents.CMChipContainer>
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
