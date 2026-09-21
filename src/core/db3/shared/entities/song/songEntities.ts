import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xSong, xSongCreditType, xSongTag } from "../../schema/song";

export const songEntity = defineEntity<Prisma.SongDelegate>()({
    schema: xSong,
});

export const songTagEntity = defineEntity<Prisma.SongTagDelegate>()({
    schema: xSongTag,
});

export const songCreditTypeEntity = defineEntity<Prisma.SongCreditTypeDelegate>()({
    schema: xSongCreditType,
});
