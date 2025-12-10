import { Prisma } from "db";
import * as db3 from "@db3/db3";
import { TableAccessor } from "@/shared/rootroot";
import { assert } from "blitz";

////////////////////////////////////////////////////////////////
export type EnrichEventInput = Partial<Prisma.EventGetPayload<{ include: { tags: true } }>>;
export type EnrichedEvent<T extends EnrichEventInput> = Omit<T, 'tags'> & Prisma.EventGetPayload<{
    select: {
        status: true,// add the fields we are treating
        type: true,
        visiblePermission: true,
        tags: {
            include: {
                eventTag: true,
            }
        }
    },
}>;

export type EnrichedSearchEventPayload = EnrichedEvent<db3.EventSearch_Event>;

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichSearchResultEvent<T extends EnrichEventInput>(
    event: T,
    data: {
        eventStatus: TableAccessor<Prisma.EventStatusGetPayload<{}>>;
        eventType: TableAccessor<Prisma.EventTypeGetPayload<{}>>;
        permission: TableAccessor<Prisma.PermissionGetPayload<{}>>;
        eventTag: TableAccessor<Prisma.EventTagGetPayload<{}>>;
    },
): EnrichedEvent<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    if (!event) {
        console.log(`wut`);
    }
    return {
        ...event,
        status: data.eventStatus.getById(event.statusId),
        type: data.eventType.getById(event.typeId),
        visiblePermission: data.permission.getById(event.visiblePermissionId),
        tags: (event.tags || []).map((t) => {
            const tag = data.eventTag.getById(t.eventTagId);
            if (!tag) {
                assert(false, `Event ${event.id} has tag ${t.eventTagId} which is not yet cached.`);
            }
            const ret = {
                ...t,
                eventTag: data.eventTag.getById(t.eventTagId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.eventTag.sortOrder - b.eventTag.sortOrder), // respect ordering
    };
}
