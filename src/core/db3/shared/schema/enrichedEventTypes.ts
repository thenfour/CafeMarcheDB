import { TableAccessor } from "@/shared/rootroot";
import { assert } from "blitz";
import * as db3 from "@db3/db3";

////////////////////////////////////////////////////////////////
export type EnrichEventInput = Partial<db3.EventClientPayload_Verbose>;
export type EnrichedEvent<T extends EnrichEventInput> = Omit<
    T,
    "status" | "type" | "visiblePermission" | "tags"
> & {
    status: db3.EventStatusDashboardClient | null;
    type: db3.EventTypeDashboardClient | null;
    visiblePermission: db3.PermissionDashboardClient | null;
    tags: (db3.EventTagAssignmentClientPayload & {
        eventTag: db3.EventTagDashboardClient;
    })[];
};

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichSearchResultEvent<T extends EnrichEventInput>(
    event: T,
    data: {
        eventStatus: TableAccessor<db3.EventStatusDashboardClient>;
        eventType: TableAccessor<db3.EventTypeDashboardClient>;
        permission: TableAccessor<db3.PermissionDashboardClient>;
        eventTag: TableAccessor<db3.EventTagDashboardClient>;
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
        status: data.eventStatus.getById(event.statusId) ?? null,
        type: data.eventType.getById(event.typeId) ?? null,
        visiblePermission: data.permission.getById(event.visiblePermissionId) ?? null,
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
