import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xEvent, xEventStatus, xEventTag, xEventType } from "../../schema/event";

export const eventEntity = defineEntity<Prisma.EventDelegate>()({
    schema: xEvent,
});

export const eventTypeEntity = defineEntity<Prisma.EventTypeDelegate>()({
    schema: xEventType,
});

export const eventStatusEntity = defineEntity<Prisma.EventStatusDelegate>()({
    schema: xEventStatus,
});

export const eventTagEntity = defineEntity<Prisma.EventTagDelegate>()({
    schema: xEventTag,
});
