import { Prisma } from "db";
import * as db3 from "@db3/db3";
import { TableAccessor } from "@/shared/rootroot";
import type { FileTagPublicId, InstrumentPublicId } from "shared/publicId";


export type EnrichFileInput = Omit<
    Partial<Prisma.FileGetPayload<{}>>,
    "tags" | "taggedInstruments"
> & {
    tags?: db3.FileTagAssignmentReferenceClientPayload[];
    taggedInstruments?: db3.FileInstrumentTagReferenceClientPayload[];
};

type EnrichedFileInstrumentTag = db3.FileInstrumentTagReferenceClientPayload & {
    instrument: db3.InstrumentDashboardClient;
};

type EnrichedFileTag = db3.FileTagAssignmentReferenceClientPayload & {
    fileTag: db3.FileTagDashboardClient;
};

export type EnrichedFile<T extends EnrichFileInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "visiblePermission"
    | "tags"
    | "taggedInstruments"
> & {
    visiblePermission: db3.PermissionDashboardClient | null | undefined;
    tags: EnrichedFileTag[];
    taggedInstruments: EnrichedFileInstrumentTag[];
};


// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichFile<
    T extends EnrichFileInput,
    TData extends {
        instrument: TableAccessor<db3.InstrumentDashboardClient, InstrumentPublicId>;
        fileTag: TableAccessor<db3.FileTagDashboardClient, FileTagPublicId>;
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
                instrument: data.instrument.getById(t.instrumentId)!, // enrich!
            };
            return ret;
        }),
        tags: (item.tags || []).map((t) => {
            const ret: EnrichedFileTag = {
                ...t,
                fileTag: data.fileTag.getById(t.fileTagId)!, // enrich!
            };
            return ret;
        }),
    };
}

