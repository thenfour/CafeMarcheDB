import { TableAccessor } from "@/shared/rootroot";
import { Prisma } from "db";
import * as db3 from "@db3/db3";

type EnrichUserDbInput = Partial<Prisma.UserGetPayload<{
    include: {
        tags: true,
        instruments: true,
    }
}>>;
export type EnrichUserInput = EnrichUserDbInput | db3.UserClientPayload;

type EnrichedUserInstrument = Omit<Prisma.UserInstrumentGetPayload<{}>, "instrumentId"> & {
    instrumentId: db3.InstrumentIdentity;
    instrument: db3.InstrumentDashboardClient;
};

export type EnrichedUser<T extends EnrichUserInput> = Omit<T,
    'role'
    | 'tags'
    | 'instruments'
> & {
    role: db3.CompleteRoleDashboardClient | null | undefined;
    tags: (Prisma.UserTagAssignmentGetPayload<{}> & {
        userTag: db3.UserTagDashboardClient;
    })[];
    instruments: EnrichedUserInstrument[];
};


// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichUser<T extends EnrichUserInput>(
    item: T,
    roles: TableAccessor<db3.CompleteRoleDashboardClient>,
    userTags: TableAccessor<db3.UserTagDashboardClient>,
    instruments: TableAccessor<db3.InstrumentDashboardClient>
): EnrichedUser<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    const ret = {
        ...item,
        role: item.roleId == null ? null : roles.getById(item.roleId),

        tags: (item.tags || []).map((assoc) => {
            const ret: Prisma.UserTagAssignmentGetPayload<{}> & {
                userTag: db3.UserTagDashboardClient;
            } = {
                ...assoc,
                userTag: userTags.getById(assoc.userTagId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.userTag.sortOrder - b.userTag.sortOrder), // respect ordering

        instruments: (item.instruments || []).map((assoc) => {
            const ret: EnrichedUserInstrument = {
                ...assoc,
                instrument: instruments.find(
                    instrument => db3.getInstrumentIdentity(instrument) === assoc.instrumentId,
                )! // enrich!
            };
            return ret;
        }).sort((a, b) => a.instrument.sortOrder - b.instrument.sortOrder), // respect ordering
    };

    // TypeScript cannot reduce this generic Omit/intersection after object spread,
    // but each replaced property is constructed with the exact EnrichedUser type above.
    return ret as EnrichedUser<T>;
}

export type EnrichedVerboseUser = EnrichedUser<db3.UserClientPayload>;
