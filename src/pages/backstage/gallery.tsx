import { BlitzPage } from "@blitzjs/next";
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import { Divider } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { parseMimeType } from "shared/utils";
import { useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import * as CMCoreComponents from "src/core/components/CMCoreComponents";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { DateTimeRangeControlExample } from "src/core/components/DateTimeRangeControl";
import { IconEditCell } from "src/core/db3/components/IconSelectDialog";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React from "react";
import * as mime from 'mime';

const MainContent = () => {
    const [leaf, setLeaf] = React.useState<string>("");
    const [mimeTypeStr, setMimeTypeStr] = React.useState<string>("");
    //parseMimeType

    useAuthorizationOrThrow("gallyery", Permission.sysadmin);
    const mimeType = (mime as any).getType(leaf); // requires a leaf only, for some reason explicitly fails on a full path.

    return <>
        <CMCoreComponents.CMSinglePageSurfaceCard>

            <h3>DateTimeRange</h3>
            <div>
                <DateTimeRangeControlExample />
            </div>
        </CMCoreComponents.CMSinglePageSurfaceCard>

        <NameValuePair
            isReadOnly={false}
            name="Leaf"
            value={<div>
                <CMTextInputBase value={leaf} onChange={(e, v) => setLeaf(v)} />
                <pre>Mime: {mimeType}</pre>
                <pre>{JSON.stringify(parseMimeType(mimeType), undefined, 2)}</pre>
            </div>}
        />

        <NameValuePair
            isReadOnly={false}
            name="Mime type"
            value={<div>
                <CMTextInputBase value={mimeTypeStr} onChange={(e, v) => setMimeTypeStr(v)} />
                <pre>{JSON.stringify(parseMimeType(mimeTypeStr))}</pre>
            </div>}
        />


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
