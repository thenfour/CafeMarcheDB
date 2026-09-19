import { TableAccessor } from "@/shared/rootroot";
import { Prisma } from "db";
import type { DashboardInstrumentPayload, InstrumentClientPayload, InstrumentFunctionalGroupClientPayload } from "./prismArgs";
import type { InstrumentFunctionalGroupPublicId } from "shared/publicId";


export type EnrichInstrumentInput = DashboardInstrumentPayload;
export type EnrichedInstrument<T extends EnrichInstrumentInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "functionalGroup"
    | "instrumentTags"
> & Pick<InstrumentClientPayload, "functionalGroup" | "instrumentTags">;

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichInstrument<T extends EnrichInstrumentInput>(
    item: T,
    data: {
        instrumentFunctionalGroup: TableAccessor<InstrumentFunctionalGroupClientPayload, InstrumentFunctionalGroupPublicId>;
        instrumentTag: TableAccessor<Prisma.InstrumentTagGetPayload<{}>>;
    },
): EnrichedInstrument<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    return {
        ...item,
        functionalGroup: data.instrumentFunctionalGroup.getById(item.functionalGroupId)!,
        instrumentTags: (item.instrumentTags || []).map((t) => {
            const ret: Prisma.InstrumentTagAssociationGetPayload<{ include: { tag: true } }> = {
                ...t,
                tag: data.instrumentTag.getById(t.tagId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.tag.sortOrder - b.tag.sortOrder), // respect ordering
    } as EnrichedInstrument<T>;
}


