import { TableAccessor } from "@/shared/rootroot";
import { assert } from "blitz";
import * as db3 from "@db3/db3";
import type { EventStatusPublicId, EventTagPublicId, EventTypePublicId, PermissionPublicId, UserTagPublicId } from "shared/publicId";

type EnrichedExpectedAttendanceUserTag = db3.UserTagDashboardClient & Pick<
    db3.EventExpectedAttendanceUserTagClientPayload,
    "userAssignments"
>;

////////////////////////////////////////////////////////////////
export type EnrichEventInput = Partial<db3.EventClientPayload_Verbose>;
export type EnrichedEvent<T extends EnrichEventInput> = Omit<
    T,
    "status" | "type" | "visiblePermission" | "tags" | "expectedAttendanceUserTag"
> & {
    status: db3.EventStatusDashboardClient | null;
    type: db3.EventTypeDashboardClient | null;
    visiblePermission: db3.PermissionDashboardClient | null;
    tags: (db3.EventTagAssignmentClientPayload & {
        eventTag: db3.EventTagDashboardClient;
    })[];
    expectedAttendanceUserTag: EnrichedExpectedAttendanceUserTag | null;
};

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichSearchResultEvent<T extends EnrichEventInput>(
    event: T,
    data: {
        eventStatus: TableAccessor<db3.EventStatusDashboardClient, EventStatusPublicId>;
        eventType: TableAccessor<db3.EventTypeDashboardClient, EventTypePublicId>;
        permission: TableAccessor<db3.PermissionDashboardClient, PermissionPublicId>;
        eventTag: TableAccessor<db3.EventTagDashboardClient, EventTagPublicId>;
        userTag: TableAccessor<db3.UserTagDashboardClient, UserTagPublicId>;
    },
): EnrichedEvent<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    if (!event) {
        console.log(`wut`);
    }
    const expectedAttendanceUserTag = event.expectedAttendanceUserTag
        ? data.userTag.getById(event.expectedAttendanceUserTag.publicId)
        : null;
    if (event.expectedAttendanceUserTag && !expectedAttendanceUserTag) {
        assert(false, `Event ${event.id} has user tag ${event.expectedAttendanceUserTag.publicId} which is not yet cached.`);
    }

    return {
        ...event,
        status: data.eventStatus.getById(event.statusId) ?? null,
        type: data.eventType.getById(event.typeId) ?? null,
        visiblePermission: data.permission.getById(event.visiblePermissionId) ?? null,
        expectedAttendanceUserTag: event.expectedAttendanceUserTag
            ? {
                ...event.expectedAttendanceUserTag,
                ...expectedAttendanceUserTag!,
                userAssignments: event.expectedAttendanceUserTag.userAssignments,
            }
            : null,
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
