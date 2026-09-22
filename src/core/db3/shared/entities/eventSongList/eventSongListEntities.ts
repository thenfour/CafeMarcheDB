import { defineEntity } from "../../core/db3Entity";
import { xEventSongList, xEventSongListDivider, xEventSongListSong } from "../../schema/event";

export const eventSongListEntity = defineEntity({
    schema: xEventSongList,
    getIdentity: (songList: { id: number }) => songList.id,
});

export const eventSongListSongEntity = defineEntity({
    schema: xEventSongListSong,
    getIdentity: (song: { id: number }) => song.id,
});

export const eventSongListDividerEntity = defineEntity({
    schema: xEventSongListDivider,
    getIdentity: (divider: { id: number }) => divider.id,
});
