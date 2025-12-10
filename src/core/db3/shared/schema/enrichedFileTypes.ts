import { Prisma } from "db";
import * as db3 from "@db3/db3";
import { TableAccessor } from "@/shared/rootroot";


export type EnrichFileInput = Partial<Prisma.FileGetPayload<{
    include: {
        tags: true,
        taggedInstruments: true,
    },
}>>;
export type EnrichedFile<T extends EnrichFileInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "visiblePermission"
    | "tags"
    | "taggedInstruments"
> & Prisma.FileGetPayload<{ // add the stuff we're enriching with.
    select: { // must be select so we don't accidentally require all fields.
        visiblePermission: true,
        tags: {
            include: {
                fileTag: true,
            }
        },
        taggedInstruments: {
            include: {
                instrument: true,
            }
        },
    }
}>;


export type EnrichedVerboseFile = EnrichedFile<db3.FilePayload>;



// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichFile<T extends EnrichFileInput>(
    item: T,
    data: {
        instrument: TableAccessor<Prisma.InstrumentGetPayload<{}>>;
        fileTag: TableAccessor<Prisma.FileTagGetPayload<{}>>;
        permission: TableAccessor<Prisma.PermissionGetPayload<{}>>;
    },
): EnrichedFile<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    return {
        ...item,
        visiblePermission: data.permission.getById(item.visiblePermissionId),
        taggedInstruments: (item.taggedInstruments || []).map((t) => {
            const ret: Prisma.FileInstrumentTagGetPayload<{ include: { instrument: true } }> = {
                ...t,
                instrument: data.instrument.getById(t.instrumentId)!, // enrich!
            };
            return ret;
        }),
        tags: (item.tags || []).map((t) => {
            const ret: Prisma.FileTagAssignmentGetPayload<{ include: { fileTag: true } }> = {
                ...t,
                fileTag: data.fileTag.getById(t.fileTagId)!, // enrich!
            };
            return ret;
        }),
    };
}

