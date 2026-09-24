import { FolderZip, OndemandVideo } from "@mui/icons-material";
import { CMChip } from "src/core/components/CMChip";
import * as db3 from "src/core/db3/db3";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { gIconMap } from "../../db3/components/IconMap";
import { FileClass, GetFileClass } from "../../db3/shared/fileAPI";
import { InstrumentChip } from "../CMCoreComponents";
import { StandardVariationSpec } from "../color/palette";
import { EventChip } from "../event/EventChips";
import { Markdown } from "../markdown/Markdown";
import { GenericSearchListItem } from "../search/SearchListItem";
import { SongChip } from "../song/SongChip";
import { WikiPageChip } from "../wiki/WikiPageChip";
import { FilesFilterSpec } from "./FileClientBaseTypes";
import { useDashboardContext } from "../dashboardContext/DashboardContext";


type FileListItemProps = {
    index: number;
    file: db3.FileSearchClient;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: FilesFilterSpec;
};

export const FileIcon = ({ file }: { file: db3.FileSearchClient }) => {
    if (file.fileLeafName === undefined
        || file.mimeType === undefined
        || file.externalURI === undefined) {
        return gIconMap.AttachFile();
    }
    const fileClass = GetFileClass({
        fileLeafName: file.fileLeafName,
        mimeType: file.mimeType,
        externalURI: file.externalURI,
    });
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
    const dashboardContext = useDashboardContext();
    // const appContext = useAppContext();
    //const visInfo = dashboardContext.getVisibilityInfo(props.file);
    const uploadedAt = props.file.uploadedAt ? new Date(props.file.uploadedAt) : null;
    const uploadedByUser = props.file.uploadedByUser ? props.file.uploadedByUser.name : null;
    return <GenericSearchListItem<db3.FileSearchClient>
        index={props.index}
        item={props.file}
        icon={<FileIcon file={props.file} />}
        refetch={props.refetch}
        href={dashboardContext.routingApi.getURIForFileLandingPage(props.file)}
        title={props.file.fileLeafName || "Restricted file"}
        credits={[
            props.file.description && <Markdown markdown={props.file.description} />,
        ]}
        bodyContent={
            <div className="chips">
                {(props.file.tags || []).map(tag => (
                    <CMChip
                        key={db3.xFileTagAssignment.getIdentity(tag)}
                        color={tag.fileTag.color}
                        variation={{
                            ...StandardVariationSpec.Weak,
                            selected: props.filterSpec.tagFilter.options.includes(tag.fileTagId),
                        }}
                        size="small"
                        shape="rectangle"
                    >
                        {tag.fileTag.text}
                    </CMChip>
                ))}

                {(props.file.taggedEvents || []).map(taggedEvent => {
                    const event = taggedEvent.event;
                    return event.name !== undefined
                        && event.startsAt !== undefined
                        && event.statusId !== undefined
                        && event.typeId !== undefined
                        ? <EventChip key={taggedEvent.id} value={{
                            id: event.id,
                            name: event.name,
                            startsAt: event.startsAt,
                            statusId: event.statusId,
                            typeId: event.typeId,
                        }} size="small" variation={StandardVariationSpec.Weak} />
                        : null;
                })}

                {/* {(props.file.taggedUsers || []).map(taggedUser => (
                    <UserChip key={taggedUser.id} value={taggedUser.user} size="small" variation={StandardVariationSpec.Weak} />
                ))} */}

                {(props.file.taggedSongs || []).map(taggedSong => taggedSong.song.name === undefined
                    ? null
                    : <SongChip key={taggedSong.id} value={{
                        id: taggedSong.song.id,
                        name: taggedSong.song.name,
                    }} size="small" variation={StandardVariationSpec.Weak} />)}

                {(props.file.taggedInstruments || []).map(taggedInstrument => (
                    <InstrumentChip key={taggedInstrument.id} value={taggedInstrument.instrument} size="small" variation={StandardVariationSpec.Weak} />
                ))}

                {(props.file.taggedWikiPages || []).map(taggedWikiPage => taggedWikiPage.wikiPage.slug === undefined
                    ? null
                    : <WikiPageChip key={taggedWikiPage.id} slug={taggedWikiPage.wikiPage.slug} size="small" variation={StandardVariationSpec.Weak} />)}
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
