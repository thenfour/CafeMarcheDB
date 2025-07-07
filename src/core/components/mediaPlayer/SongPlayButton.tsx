// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { gIconMap } from '../../db3/components/IconMap';
import { TSongPinnedRecording } from '../../db3/shared/apiTypes';
import * as SetlistAPI from '../../db3/shared/setlistApi';
import { useMediaPlayer } from '../mediaPlayer/MediaPlayerContext';
import { MediaPlayerTrack } from '../mediaPlayer/MediaPlayerTypes';



// File-specific audio controls that use the global media player
type SongPlayButtonProps = {
    //songList: db3.EventSongListPayload;
    setlistRowItems: SetlistAPI.EventSongListItem[];
    rowIndex: number;
    //songIndex: number;
    //pinnedRecording?: any; // The pinned recording for this song, if any
    allPinnedRecordings: Record<number, TSongPinnedRecording>; // All pinned recordings for the setlist
};

export function SongPlayButton({ setlistRowItems, rowIndex, allPinnedRecordings }: SongPlayButtonProps) {
    const mediaPlayer = useMediaPlayer();
    //const song = songList.songs[songIndex]?.song;
    const rowItem = setlistRowItems[rowIndex];
    if (!rowItem || rowItem.type !== 'song') {
        return null;
    }
    const pinnedRecording = allPinnedRecordings?.[rowItem.song.id];
    if (!pinnedRecording) {
        return null;
    }

    const file = pinnedRecording;
    const isCurrent = mediaPlayer.isPlayingSetlistItem({
        fileId: file.id,
        setlistId: rowItem.eventSongListId,
        setlistItemIndex: rowIndex
    });
    const isPlaying = isCurrent && mediaPlayer.isPlaying;

    // Create a playlist from all songs in the setlist that have pinned recordings
    const createPlaylist = (): MediaPlayerTrack[] => {

        const playlist: MediaPlayerTrack[] = setlistRowItems
            .map((row, rowIndex) => {

                if (row.type === 'song') {
                    const recording = allPinnedRecordings?.[row.song.id]; // may be undefined if no pinned recording.

                    return {
                        playlistIndex: -1, // filled in later
                        setlistId: row.eventSongListId,
                        file: recording,
                        songContext: row.song,
                        setListItemContext: row,
                    } satisfies MediaPlayerTrack;
                }
                return {
                    playlistIndex: -1, // filled in later
                    setlistId: row.eventSongListId,
                    setListItemContext: row,
                } satisfies MediaPlayerTrack;
            });

        return playlist;
    };

    // Play this file via the global player
    const handlePlay = () => {
        if (isCurrent) {
            mediaPlayer.unpause();
        } else {
            const playlist = createPlaylist();
            // rowIndex happens to be the same as the playlist index because we always generate them in sync.
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

