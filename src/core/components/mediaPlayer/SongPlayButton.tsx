// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { gIconMap } from '../../db3/components/IconMap';
import { TSongPinnedRecording } from '../../db3/shared/apiTypes';
import { useMediaPlayer } from '../mediaPlayer/MediaPlayerContext';
import { MediaPlayerTrack } from '../mediaPlayer/MediaPlayerTypes';

// File-specific audio controls that use the global media player
type SongPlayButtonProps = {
    rowIndex: number;
    track: MediaPlayerTrack;
    //allPinnedRecordings: Record<number, TSongPinnedRecording>; // All pinned recordings for the setlist
    getPlaylist: () => MediaPlayerTrack[];
};

export function SongPlayButton({ rowIndex, track, getPlaylist }: SongPlayButtonProps) {
    const mediaPlayer = useMediaPlayer();

    if (!track.file) {
        return <div className='audioPreviewGatewayContainer' style={{ visibility: "hidden" }}></div>;
    }

    const isCurrent = mediaPlayer.isPlayingTrack(track);
    const isPlaying = isCurrent && mediaPlayer.isPlaying;

    // Play this file via the global player
    const handlePlay = () => {
        if (isCurrent) {
            mediaPlayer.unpause();
        } else {
            const playlist = getPlaylist();
            mediaPlayer.setPullPlaylistFn(getPlaylist);
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

