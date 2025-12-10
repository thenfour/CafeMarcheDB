import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { SelectEnglishNoun } from "shared/lang";
import { IsNullOrWhitespace } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMChipContainer, CMStandardDBChip } from "src/core/components/CMChip";
import { CMLink } from "src/core/components/CMLink";
import { CalculateSongMetadata, GetSongFileInfo } from "src/core/components/song/SongComponentsBase";
import { gIconMap } from "src/core/db3/components/IconMap";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { SongsFilterSpec } from "./SongClientBaseTypes";
import { StandardVariationSpec } from "../color/palette";
import { EnrichedVerboseSong } from "../../db3/shared/schema/enrichedSongTypes";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

type SongListItemProps = {
    index: number;
    song: EnrichedVerboseSong;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: SongsFilterSpec;
};

export const SongListItem = (props: SongListItemProps) => {
    const dashboardContext = useDashboardContext();
    const songData = CalculateSongMetadata(props.song);
    const fileInfo = GetSongFileInfo(props.song, dashboardContext);
    const hasBpm = !IsNullOrWhitespace(songData.formattedBPM);
    const hasLength = !!songData.song.lengthSeconds;
    const hasPartitions = fileInfo.partitions.length > 0;
    const hasRecordings = fileInfo.recordings.length > 0;
    const hasOtherFiles = fileInfo.otherFiles.length > 0;
    const hasAnyFooterInfo = hasBpm || hasLength || hasPartitions || hasRecordings || hasOtherFiles;

    return <div className={`songListItem`}>
        <AppContextMarker name="SongListItem" songId={props.song.id}>
            <div className="titleLine">
                <div className="topTitleLine">
                    <CMLink className="nameLink" href={songData.songURI} trackingFeature={ActivityFeature.link_follow_internal}>{props.song.name}</CMLink>
                    {props.song.introducedYear && <span className="introducedYear">({props.song.introducedYear})</span>}
                    <div style={{ flexGrow: 1 }}></div>
                    <span className="resultIndex">#{props.index}</span>
                </div>
                <div className="aliases">{props.song.aliases}</div>
            </div>
            <div className="searchBody">
                <CMChipContainer className="songTags">
                    {props.song.tags.map(tag => <CMStandardDBChip
                        key={tag.id}
                        size='small'
                        model={tag.tag}
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.options.includes(tag.tagId) }}
                        getTooltip={(_) => tag.tag.description}
                    />)}
                </CMChipContainer>

                {!!props.song.credits.length && (
                    <div className="credits">
                        {props.song.credits.map(credit => {
                            const creditType = dashboardContext.songCreditType.getById(credit.typeId);
                            return <div className="credit row" key={credit.id}>
                                {!!credit.user && <><div className="userName fieldItem">{credit.user?.name}</div></>}
                                {!!creditType && <div className="creditType fieldItem">{creditType.text}</div>}
                                {!IsNullOrWhitespace(credit.year) && <div className="year fieldItem">({credit.year})</div>}
                                {!IsNullOrWhitespace(credit.comment) && <div className="creditComment fieldItem">{credit.comment}</div>}
                            </div>;
                        })}
                    </div>
                )}

                {hasAnyFooterInfo && (
                    <div className="lengthBpmLine row">
                        {hasBpm && <div className="bpm fieldItem"><span className="label">BPM: </span><div className="value">{songData.formattedBPM}</div></div>}
                        {hasLength && <div className="length  fieldItem"><span className="label">Length: </span><div className="value">{songData.formattedLength}</div></div>}
                        {hasPartitions && <div className="partitionCount fieldItem">{gIconMap.LibraryMusic()} {fileInfo.partitions.length} {SelectEnglishNoun(fileInfo.partitions.length, "partition", "partitions")}</div>}
                        {hasRecordings && <div className="recordingCount fieldItem">{gIconMap.PlayCircleOutline()} {fileInfo.recordings.length} {SelectEnglishNoun(fileInfo.recordings.length, "recording", "recordings")}</div>}
                        {hasOtherFiles && <div className="otherFilesCount fieldItem">{gIconMap.AttachFile()} {fileInfo.otherFiles.length} {SelectEnglishNoun(fileInfo.otherFiles.length, "unsorted file", "unsorted files")}</div>}
                    </div>
                )}
            </div>
        </AppContextMarker>
    </div>;
};








