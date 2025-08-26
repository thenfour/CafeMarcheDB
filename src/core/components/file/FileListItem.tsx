import { FolderZip, OndemandVideo } from "@mui/icons-material";
import { CMChip } from "src/core/components/CMChip";
import { getURIForFileLandingPage } from "src/core/db3/clientAPILL";
import * as db3 from "src/core/db3/db3";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { gIconMap } from "../../db3/components/IconMap";
import { FileClass, GetFileClass } from "../../db3/shared/fileAPI";
import { Markdown } from "../markdown/Markdown";
import { GenericSearchListItem } from "../search/SearchListItem";
import { FilesFilterSpec } from "./FileClientBaseTypes";
import { StandardVariationSpec } from "../color/palette";
import { UserChip } from "../user/userChip";
import { SongChip } from "../song/SongChip";
import { EventChip } from "../event/EventChips";
import { InstrumentChip } from "../CMCoreComponents";
import { WikiPageChip } from "../wiki/WikiPageChip";


type FileListItemProps = {
    index: number;
    file: db3.EnrichedFile<db3.FilePayload>;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: FilesFilterSpec;
};

export const FileIcon = ({ file }: { file: db3.EnrichedFile<db3.FilePayload> }) => {
    const fileClass = GetFileClass(file);
    switch (fileClass) {
        case FileClass.Audio:
            return gIconMap.MusicNote();
        case FileClass.Video:
            return <OndemandVideo />;
        case FileClass.Image:
            return gIconMap.Image();
        case FileClass.Document:
            return gIconMap.Article();
        case FileClass.Archive:
            return <FolderZip />;
        case FileClass.Link:
            return gIconMap.Link();
        default:
            return gIconMap.AttachFile();
    }
};


export const FileListItem = (props: FileListItemProps) => {
    // const dashboardContext = React.useContext(DashboardContext);
    // const appContext = useAppContext();
    //const visInfo = dashboardContext.getVisibilityInfo(props.file);
    const uploadedAt = props.file.uploadedAt ? new Date(props.file.uploadedAt) : null;
    const uploadedByUser = props.file.uploadedByUser ? props.file.uploadedByUser.name : null;
    return <GenericSearchListItem<db3.EnrichedFile<db3.FilePayload>>
        index={props.index}
        item={props.file}
        icon={<FileIcon file={props.file} />}
        refetch={props.refetch}
        href={getURIForFileLandingPage(props.file)}
        title={props.file.fileLeafName}
        credits={[
            props.file.description && <Markdown markdown={props.file.description} />,
        ]}
        bodyContent={
            <div className="chips">
                {(props.file.tags || []).map(tag => (
                    <CMChip
                        key={tag.id}
                        color={tag.fileTag.color}
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.options.includes(tag.fileTagId) }}
                        size="small"
                        shape="rectangle"
                    >
                        {tag.fileTag.text}
                    </CMChip>
                ))}

                {(props.file.taggedEvents || []).map(taggedEvent => (
                    <EventChip key={taggedEvent.id} value={taggedEvent.event} size="small" variation={StandardVariationSpec.Weak} />
                ))}

                {/* {(props.file.taggedUsers || []).map(taggedUser => (
                    <UserChip key={taggedUser.id} value={taggedUser.user} size="small" variation={StandardVariationSpec.Weak} />
                ))} */}

                {(props.file.taggedSongs || []).map(taggedSong => (
                    <SongChip key={taggedSong.id} value={taggedSong.song} size="small" variation={StandardVariationSpec.Weak} />
                ))}

                {(props.file.taggedInstruments || []).map(taggedInstrument => (
                    <InstrumentChip key={taggedInstrument.id} value={taggedInstrument.instrument} size="small" variation={StandardVariationSpec.Weak} />
                ))}

                {(props.file.taggedWikiPages || []).map(taggedWikiPage => (
                    <WikiPageChip key={taggedWikiPage.id} slug={taggedWikiPage.wikiPage.slug} size="small" variation={StandardVariationSpec.Weak} />
                ))}
            </div>
        }

        footerContent={<>
            {uploadedAt && <span>Uploaded: {uploadedAt.toLocaleDateString()}</span>}
            {uploadedByUser && <span>By: {uploadedByUser}</span>}
            <span>{props.file.sizeBytes ? `Size: ${Math.round(props.file.sizeBytes / 1024)} KB` : 'Size: Unknown'}</span>
            <span>{props.file.mimeType ? `Type: ${props.file.mimeType}` : 'Type: Unknown'}</span>
        </>
        }
    />;
};