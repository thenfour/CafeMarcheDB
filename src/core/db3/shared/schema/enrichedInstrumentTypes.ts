import { TableAccessor } from "@/shared/rootroot";
import { Prisma } from "db";


export type EnrichInstrumentInput = Partial<Prisma.InstrumentGetPayload<{ include: { instrumentTags: true } }>>;
export type EnrichedInstrument<T extends EnrichInstrumentInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "functionalGroup"
    | "instrumentTags"
> & Prisma.InstrumentGetPayload<{
    select: { // must be select so we don't accidentally require all fields.
        functionalGroup: true,
        instrumentTags: {
            include: {
                tag: true,
            }
        },
    }
}>;

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichInstrument<T extends EnrichInstrumentInput>(
    item: T,
    data: {
        instrumentFunctionalGroup: TableAccessor<Prisma.InstrumentFunctionalGroupGetPayload<{}>>;
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
    };
}


