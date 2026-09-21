import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xEventSongList, xEventSongListDivider, xEventSongListSong } from "../../schema/event";

export const eventSongListEntity = defineEntity<Prisma.EventSongListDelegate>()({
    schema: xEventSongList,
});

export const eventSongListSongEntity = defineEntity<Prisma.EventSongListSongDelegate>()({
    schema: xEventSongListSong,
});

export const eventSongListDividerEntity = defineEntity<Prisma.EventSongListDividerDelegate>()({
    schema: xEventSongListDivider,
});
