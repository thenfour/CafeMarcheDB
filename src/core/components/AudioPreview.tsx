
import { nanoid } from 'nanoid';
import React from "react";
import * as db3 from "src/core/db3/db3";
import WaveSurfer from "wavesurfer.js";
import { API } from '../db3/clientAPI';
import { gIconMap } from '../db3/components/IconMap';


export interface AudioPreviewProps {
    value: db3.FileWithTagsPayload;
};

export const AudioPreview = (props: AudioPreviewProps) => {
    const [myWaveSurfer, setWaveSurfer] = React.useState<WaveSurfer | null>(null);
    const [myID] = React.useState<string>(`waveform-${nanoid()}`);
    const [myRef, setMyRef] = React.useState<HTMLDivElement | null>(null);

    const UnmountWavesurfer = () => {
        if (myWaveSurfer) {
            myWaveSurfer.unAll();
            myWaveSurfer.destroy();
            setWaveSurfer(null);
        }
    };

    React.useEffect(() => {

        if (myRef) {
            UnmountWavesurfer();

            const ws = WaveSurfer.create({
                url: API.files.getURIForFile(props.value),
                //barWidth: 2,
                //cursorWidth: 1,
                mediaControls: true,
                container: myRef,
                height: 80,
                progressColor: "#88c",
                waveColor: "#ddd",
                cursorColor: "#00f",
            });

            setWaveSurfer(ws);
        }
        return () => {
            UnmountWavesurfer();
        };
    }, [myRef]);

    return <div className="CMDBAudioPreview">
        <div id={myID} ref={(ref) => setMyRef(ref)} />
    </div>;
};



export interface AudioPreviewBehindButtonProps {
    value: db3.FileWithTagsPayload;
};

export const AudioPreviewBehindButton = (props: AudioPreviewBehindButtonProps) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    return <div className="audioPreviewGatewayContainer">
        {isOpen ? <AudioPreview value={props.value} /> : (<div className="audioPreviewGatewayButton interactable" onClick={() => setIsOpen(true)}>
            {gIconMap.PlayCircleOutline()}
            Preview
        </div>)}
    </div>;

};
