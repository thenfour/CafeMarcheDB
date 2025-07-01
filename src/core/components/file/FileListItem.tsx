import { CMLink } from "@/src/core/components/CMLink";
import React from "react";
import { StandardVariationSpec } from "shared/color";
import { CMChip } from "src/core/components/CMChip";
import { AdminInspectObject } from "src/core/components/CMCoreComponents2";
import { DashboardContext } from "src/core/components/DashboardContext";
import { FilesFilterSpec } from "./FileComponentsBase";
import { getURIForFileLandingPage } from "src/core/db3/clientAPILL";
import * as db3 from "src/core/db3/db3";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";


type FileListItemProps = {
    index: number;
    file: db3.EnrichedFile<db3.FilePayload>;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: FilesFilterSpec;
};

export const FileListItem = (props: FileListItemProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const visInfo = dashboardContext.getVisibilityInfo(props.file);

    return <div className={`songListItem ${visInfo.className}`}>
        <div className="titleLine">
            <div className="topTitleLine">
                <CMLink className="nameLink" href={getURIForFileLandingPage(props.file)}>
                    {props.file.fileLeafName}
                </CMLink>
                <div style={{ flexGrow: 1 }}>
                    <AdminInspectObject src={props.file} label="Obj" />
                </div>
                <span className="resultIndex">#{props.index}</span>
            </div>
        </div>

        <div className="credits">
            <div className="credit row">
                <div className="fieldItem">{props.file.description}</div>
            </div>
            <div className="credit row">
                <div className="fieldCaption">Uploaded:</div>
                <div className="fieldItem">{props.file.uploadedAt?.toLocaleDateString()}</div>
                <div className="fieldCaption">By:</div>
                <div className="fieldItem">{props.file.uploadedByUser?.name}</div>
                <div className="fieldCaption">Size:</div>
                <div className="fieldItem">{props.file.sizeBytes ? `${Math.round(props.file.sizeBytes / 1024)} KB` : 'Unknown'}</div>
                <div className="fieldCaption">Type:</div>
                <div className="fieldItem">{props.file.mimeType || 'Unknown'}</div>
            </div>
        </div>

        <div className="chips">
            {(props.file.tags || []).map(tag => (
                <CMChip
                    key={tag.id}
                    color={tag.fileTag.color}
                    variation={StandardVariationSpec.Weak}
                    size="small"
                    shape="rectangle"
                >
                    {tag.fileTag.text}
                </CMChip>
            ))}
        </div>    </div>;
};
