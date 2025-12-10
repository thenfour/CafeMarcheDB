import { TableAccessor } from "@/shared/rootroot";
import { Prisma } from "db";
import { EnrichedInstrument } from "./enrichedInstrumentTypes";
import * as db3 from "@db3/db3";

export type EnrichUserInput = Partial<Prisma.UserGetPayload<{
    include: {
        tags: true,
        instruments: true,
    }
}>>;
export type EnrichedUser<T extends EnrichUserInput> = Omit<T,
    'tags'
    | 'instruments'
> & Prisma.UserGetPayload<{
    select: {
        role: true,
        tags: {
            include: {
                userTag: true,
            }
        },
        instruments: {
            include: {
                instrument: {
                    include: {
                        functionalGroup: true,
                    }
                }
            }
        }
    },
}>;


// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichUser<T extends EnrichUserInput>(
    item: T,
    roles: TableAccessor<Prisma.RoleGetPayload<{}>>,
    userTags: TableAccessor<Prisma.UserTagGetPayload<{}>>,
    instruments: TableAccessor<EnrichedInstrument<Prisma.InstrumentGetPayload<{}>>>
): EnrichedUser<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    const ret = {
        ...item,
        role: roles.getById(item.roleId),

        tags: (item.tags || []).map((assoc) => {
            const ret: Prisma.UserTagAssignmentGetPayload<{ include: { userTag: true } }> = {
                ...assoc,
                userTag: userTags.getById(assoc.userTagId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.userTag.sortOrder - b.userTag.sortOrder), // respect ordering

        instruments: (item.instruments || []).map((assoc) => {
            const ret: Prisma.UserInstrumentGetPayload<{ include: { instrument: { include: { functionalGroup: true } } } }> = {
                ...assoc,
                instrument: instruments.getById(assoc.instrumentId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.instrument.sortOrder - b.instrument.sortOrder), // respect ordering
    };

    return ret;
}

export type EnrichedVerboseUser = EnrichedUser<db3.UserPayload>;
