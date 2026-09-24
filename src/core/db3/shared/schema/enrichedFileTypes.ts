import { Prisma } from "db";
import * as db3 from "@db3/db3";
import { TableAccessor } from "@/shared/rootroot";


export type EnrichFileInput = Partial<Prisma.FileGetPayload<{
    include: {
        tags: true,
        taggedInstruments: true,
    },
}>>;

type EnrichedFileInstrumentTag = Prisma.FileInstrumentTagGetPayload<{}> & {
    instrument: db3.InstrumentDashboardClient;
};

export type EnrichedFile<T extends EnrichFileInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "visiblePermission"
    | "tags"
    | "taggedInstruments"
> & {
    visiblePermission: db3.PermissionDashboardClient | null | undefined;
    tags: (Prisma.FileTagAssignmentGetPayload<{}> & {
        fileTag: db3.FileTagDashboardClient;
    })[];
    taggedInstruments: EnrichedFileInstrumentTag[];
};


export type EnrichedVerboseFile = EnrichedFile<db3.FilePayload>;



// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichFile<
    T extends EnrichFileInput,
    TData extends {
        instrument: TableAccessor<db3.InstrumentDashboardClient>;
        fileTag: TableAccessor<db3.FileTagDashboardClient>;
        permission: TableAccessor<db3.PermissionDashboardClient>;
    }>(
        item: T,
        data: TData,
    ): EnrichedFile<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    return {
        ...item,
        visiblePermission: data.permission.getById(item.visiblePermissionId),
        taggedInstruments: (item.taggedInstruments || []).map((t) => {
            const ret: EnrichedFileInstrumentTag = {
                ...t,
                instrument: data.instrument.find(
                    instrument => db3.getInstrumentIdentity(instrument) === t.instrumentId,
                )!, // enrich!
            };
            return ret;
        }),
        tags: (item.tags || []).map((t) => {
            const ret: Prisma.FileTagAssignmentGetPayload<{}> & {
                fileTag: db3.FileTagDashboardClient;
            } = {
                ...t,
                fileTag: data.fileTag.getById(t.fileTagId)!, // enrich!
            };
            return ret;
        }),
    };
}

