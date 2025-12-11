// stuff that clientAPI uses which doesn't require DB3ClientBasicFields to avoid a dependency cycle.

import { Prisma } from "db";

// i don't know why i wrote this function twice; if issues happen because of this one,
// explain it.
export function getFormattedBPM(song: Prisma.SongGetPayload<{ select: { startBPM: true, endBPM: true } }>) {
    if (!song.startBPM) {
        if (!song.endBPM) {
            return "";// neither specified
        }
        return `⇢${song.endBPM}`; // only end bpm
    }
    if (!song.endBPM) {
        return `${song.startBPM}⇢`; // only start bpm
    }
    if ((song.startBPM | 0) === (song.endBPM | 0)) {
        return `${song.startBPM}`; // both BPMs the same: just show 1.
    }
    return `${song.startBPM}⇢${song.endBPM}`;
}

