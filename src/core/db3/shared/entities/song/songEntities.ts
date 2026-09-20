import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xSong, xSongCreditType, xSongTag } from "../../schema/song";

export const songEntity = defineEntity<Prisma.SongDelegate>()({
    schema: xSong,
    getIdentity: (song: { id: number }) => song.id,
});

export const songTagEntity = defineEntity<Prisma.SongTagDelegate>()({
    schema: xSongTag,
    getIdentity: (tag: Prisma.SongTagGetPayload<{}>) => tag.id,
});

export const songCreditTypeEntity = defineEntity<Prisma.SongCreditTypeDelegate>()({
    schema: xSongCreditType,
    getIdentity: (creditType: Prisma.SongCreditTypeGetPayload<{}>) => creditType.id,
});
