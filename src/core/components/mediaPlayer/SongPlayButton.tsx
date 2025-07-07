// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { gIconMap } from '../../db3/components/IconMap';
import { TSongPinnedRecording } from '../../db3/shared/apiTypes';
import { useMediaPlayer } from '../mediaPlayer/MediaPlayerContext';
import { MediaPlayerTrack } from '../mediaPlayer/MediaPlayerTypes';

// // Common interface for both setlist and planner rows
// export interface PlayableRowItem {
//     type: 'song' | 'divider';
//     song?: { id: number; name: string };
//     eventSongListId?: number;
//     setlistPlanId?: number;
// }

// File-specific audio controls that use the global media player
type SongPlayButtonProps = {
    //setlistRowItems: PlayableRowItem[];
    rowIndex: number;
    track: MediaPlayerTrack;
    allPinnedRecordings: Record<number, TSongPinnedRecording>; // All pinned recordings for the setlist
    getPlaylist: () => MediaPlayerTrack[];
};

export function SongPlayButton({ rowIndex, allPinnedRecordings, track, getPlaylist }: SongPlayButtonProps) {
    const mediaPlayer = useMediaPlayer();
    // const rowItem = setlistRowItems[rowIndex];
    // if (!rowItem || rowItem.type !== 'song') {
    //     return null;
    // }

    if (!track.file) {
        return <div className='audioPreviewGatewayContainer' style={{ visibility: "hidden" }}></div>;
    }

    // const songId = rowItem.song?.id;
    // if (!songId) {
    //     return null;
    // }

    // const pinnedRecording = allPinnedRecordings?.[songId];
    // if (!pinnedRecording) {
    //     return null;
    // }

    // const file = pinnedRecording;
    // const isCurrent = mediaPlayer.isPlayingSetlistItem({
    //     fileId: file.id,
    //     setlistId: rowItem.eventSongListId,
    //     setlistPlanId: rowItem.setlistPlanId,
    //     setlistItemIndex: rowIndex
    // });

    const isCurrent = mediaPlayer.isPlayingTrack(track);
    const isPlaying = isCurrent && mediaPlayer.isPlaying;

    // // Create a playlist from all songs in the setlist that have pinned recordings
    // const createPlaylist = (): MediaPlayerTrack[] => {

    //     const playlist: MediaPlayerTrack[] = setlistRowItems
    //         .map((row, rowIndex) => {
    //             if (row.type === 'song') {
    //                 // Handle both setlist and planner row structures
    //                 const songId = row.song?.id || (row).songId;
    //                 const recording = songId ? allPinnedRecordings?.[songId] : undefined;

    //                 return {
    //                     playlistIndex: -1, // filled in later
    //                     setlistId,
    //                     file: recording,
    //                     songContext: row.song || { id: songId, name: "Unknown" },
    //                     setListItemContext: row,
    //                 } satisfies MediaPlayerTrack;
    //             }
    //             return {
    //                 playlistIndex: -1, // filled in later
    //                 setlistId,
    //                 setListItemContext: row,
    //             } satisfies MediaPlayerTrack;
    //         });

    //     return playlist;
    // };

    // Play this file via the global player
    const handlePlay = () => {
        if (isCurrent) {
            mediaPlayer.unpause();
        } else {
            const playlist = getPlaylist();
            // rowIndex happens to be the same as the playlist index because we always generate them in sync.
            const pullPlaylistFn = () => getPlaylist();
            mediaPlayer.setPullPlaylistFn(pullPlaylistFn);

            mediaPlayer.setPlaylist(playlist, rowIndex);
        }
    };

    const handlePause = () => {
        if (isCurrent) {
            mediaPlayer.pause();
        }
    };

    return (
        <div className="audioPreviewGatewayContainer">
            {isCurrent && isPlaying && (
                <div className='audioPreviewGatewayButton freeButton isPlaying' onClick={handlePause}>
                    <div className="playingIndicatorOuter">
                        <div className="playingIndicatorGlow"></div>
                        <div className="playingIndicatorSpinner playingIndicatorSpinnerAnim">
                            {gIconMap.PauseCircleOutline()}
                        </div>
                    </div>
                </div>
            )}

            {isCurrent && !isPlaying && (
                <div className='audioPreviewGatewayButton freeButton isPlaying' onClick={handlePlay}>
                    <div className="playingIndicatorOuter">
                        <div className="playingIndicatorGlow"></div>
                        <div className="playingIndicatorSpinner">
                            {gIconMap.PlayCircleOutline()}
                        </div>
                    </div>
                </div>
            )}

            {!isCurrent && (
                <div className='audioPreviewGatewayButton freeButton' onClick={handlePlay}>
                    {gIconMap.PlayCircleOutline()}
                </div>
            )}
        </div>
    );
}

