import { parsePublicId } from "shared/publicId";

export const listPublicId = (id: number) => parsePublicId<"EventSongList">(`Setlist${String(id).padStart(9, "0")}`);
export const listSongPublicId = (id: number) => parsePublicId<"EventSongListSong">(`ListSong${String(id).padStart(8, "0")}`);
export const listDividerPublicId = (id: number) => parsePublicId<"EventSongListDivider">(`ListDiv_${String(id).padStart(8, "0")}`);
