import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xEventSongList } from "../../schema/event";

export const eventSongListEntity = defineEntity<Prisma.EventSongListDelegate>()({
    schema: xEventSongList,
    getIdentity: (songList: { id: number }) => songList.id,
});
