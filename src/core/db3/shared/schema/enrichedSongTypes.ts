import { Prisma } from "db";
import * as db3 from "@db3/db3";
import { TableAccessor } from "@/shared/rootroot";

export type EnrichSongInput = Partial<Prisma.SongGetPayload<{
    include: {
        tags: true,
    }
}>>;
export type EnrichedSong<T extends EnrichSongInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "tags"
    | "visiblePermission"
> & Prisma.SongGetPayload<{ // add the stuff we're enriching with.
    select: { // must be select so we don't accidentally require all fields.
        visiblePermission: true,
        tags: {
            include: { tag: true }
        },
    }
}>;

export type EnrichedVerboseSong = EnrichedSong<db3.SongPayload_Verbose>;


// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichSong<T extends EnrichSongInput>(
    item: T,
    data: {
        songTag: TableAccessor<Prisma.SongTagGetPayload<{}>>;
        permission: TableAccessor<Prisma.PermissionGetPayload<{}>>;
    },
): EnrichedSong<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.

    // here we could also drill in and enrich things like
    // - song credits
    // - files
    // and whatever else is there.

    return {
        ...item,
        visiblePermission: data.permission.getById(item.visiblePermissionId),
        tags: (item.tags || []).map((t) => {
            const ret: Prisma.SongTagAssociationGetPayload<{ include: { tag: true } }> = {
                ...t,
                tag: data.songTag.getById(t.tagId)!, // enrich!
            };
            return ret;
        }).sort((a, b) => a.tag.sortOrder - b.tag.sortOrder), // respect ordering
    };
}



