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

export const eventEntity = defineEntity<Prisma.EventDelegate>()({
    schema: xEvent,
    getIdentity: (event: { id: number }) => event.id,
});

export const eventSegmentEntity = defineEntity<Prisma.EventSegmentDelegate>()({
    schema: xEventSegment,
    getIdentity: (segment: { id: number }) => segment.id,
});

export const eventAttendanceEntity = defineEntity<Prisma.EventAttendanceDelegate>()({
    schema: xEventAttendance,
    getIdentity: (attendance: { id: number }) => attendance.id,
});

export const eventTypeEntity = defineEntity<Prisma.EventTypeDelegate>()({
    schema: xEventType,
    getIdentity: (eventType: Prisma.EventTypeGetPayload<{}>) => eventType.id,
});

export const eventStatusEntity = defineEntity<Prisma.EventStatusDelegate>()({
    schema: xEventStatus,
    getIdentity: (eventStatus: Prisma.EventStatusGetPayload<{}>) => eventStatus.id,
});

export const eventTagEntity = defineEntity<Prisma.EventTagDelegate>()({
    schema: xEventTag,
    getIdentity: (eventTag: Prisma.EventTagGetPayload<{}>) => eventTag.id,
});
