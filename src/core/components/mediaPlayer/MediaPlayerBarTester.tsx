import { CMSmallButton, KeyValueTable } from "../CMCoreComponents2";
import { useMediaPlayer } from "./MediaPlayerContext";

export const MediaPlayerBarTester = () => {
    const mediaPlayer = useMediaPlayer();

    return (<div>
        <CMSmallButton
            onClick={() => {
                mediaPlayer.playUri(`https://citizen-dj.labs.loc.gov/audio/samplepacks/loc-fma/Chillin-Poupi_fma-169768_002_00-00-31.mp3`);
            }}
        >
            [sample A]
        </CMSmallButton>
        <CMSmallButton
            onClick={() => {
                mediaPlayer.playUri(`https://cafemarche.be/api/files/download/o0Faqsf5AnnWlFrxSpAWh.mp3/the-scout.mp3`);
            }}
        >
            [sample B]
        </CMSmallButton>
        <CMSmallButton
            onClick={() => {
                mediaPlayer.setPlaylist([
                    {
                        playlistIndex: -1, // filled in later
                        url: `https://citizen-dj.labs.loc.gov/audio/samplepacks/loc-fma/Chillin-Poupi_fma-169768_002_00-00-31.mp3`,
                    },
                    {
                        playlistIndex: -1, // filled in later
                        url: `https://cafemarche.be/api/files/download/o0Faqsf5AnnWlFrxSpAWh.mp3/the-scout.mp3`,
                    },
                ], undefined);
            }}
        >
            [sample 2-song playlist]
        </CMSmallButton>
        <CMSmallButton onClick={() => {
            mediaPlayer.unpause();
        }}>play</CMSmallButton>
        <CMSmallButton onClick={() => {
            mediaPlayer.pause();
        }}>pause</CMSmallButton>
        <CMSmallButton onClick={() => {
            mediaPlayer.setPlaylist([], undefined);
        }}>
            {"clear playlist"}
        </CMSmallButton>
        <KeyValueTable
            data={{
                "playlist length": mediaPlayer.playlist.length,
                "current index": mediaPlayer.currentIndex,
                "is playing": mediaPlayer.isPlaying,
                "audio time": mediaPlayer.playheadSeconds.toFixed(2),
                "audio duration": mediaPlayer.lengthSeconds.toFixed(2),
            }}
        />
    </div>
    );
}
