import db, { Prisma } from "db";
import { z } from "zod"

export const NewSongSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),

    startKey: z.string().nullable(),
    endKey: z.string().nullable(),
    startBPM: z.number().nullable(),
    endBPM: z.number().nullable(),

    introducedYear: z.number().nullable(),
    lengthSeconds: z.number().nullable(),
});

//   FileSongTag FileSongTag[]
//   tags        SongTagAssociation[]
//   comments    SongComment[]
//   credits     SongCredit[]
//   songLists   EventSongListSong[]
