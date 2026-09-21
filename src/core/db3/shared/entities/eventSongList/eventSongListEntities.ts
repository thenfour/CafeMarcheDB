import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xEventSongList, xEventSongListDivider, xEventSongListSong } from "../../schema/event";

export const eventSongListEntity = defineEntity<Prisma.EventSongListDelegate>()({
    schema: xEventSongList,
    getIdentity: (songList: { id: number }) => songList.id,
});

export const eventSongListSongEntity = defineEntity<Prisma.EventSongListSongDelegate>()({
    schema: xEventSongListSong,
    getIdentity: (song: { id: number }) => song.id,
});

export const eventSongListDividerEntity = defineEntity<Prisma.EventSongListDividerDelegate>()({
    schema: xEventSongListDivider,
    getIdentity: (divider: { id: number }) => divider.id,
});
