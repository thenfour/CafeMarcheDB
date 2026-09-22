import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import {
    xEvent,
    xEventAttendance,
    xEventSegment,
    xEventStatus,
    xEventTag,
    xEventType,
} from "../../schema/event";

export const eventEntity = defineEntity({
    schema: xEvent,
    getIdentity: (event: { id: number }) => event.id,
});

export const eventSegmentEntity = defineEntity({
    schema: xEventSegment,
    getIdentity: (segment: { id: number }) => segment.id,
});

export const eventAttendanceEntity = defineEntity({
    schema: xEventAttendance,
    getIdentity: (attendance: { id: number }) => attendance.id,
});

export const eventTypeEntity = defineEntity({
    schema: xEventType,
    getIdentity: (eventType: Prisma.EventTypeGetPayload<{}>) => eventType.id,
});

export const eventStatusEntity = defineEntity({
    schema: xEventStatus,
    getIdentity: (eventStatus: Prisma.EventStatusGetPayload<{}>) => eventStatus.id,
});

export const eventTagEntity = defineEntity({
    schema: xEventTag,
    getIdentity: (eventTag: Prisma.EventTagGetPayload<{}>) => eventTag.id,
});
