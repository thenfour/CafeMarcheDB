import { Mutex } from "async-mutex";
import { AssertEqualTypes, exactType } from "shared/rootroot";
import * as z from "zod"

export interface MockEvent {
    name: string;
    description: string | null;
    locationDescription: string | null;
    typeId: number | null;
    statusId: number | null;
    expectedAttendanceUserTagId: number | null;
    frontpageVisible: boolean;
    tagIds: number[];
};

// include custom fields
export type MockEventModel = MockEvent & Record<string, any>;


// Base schema for MockEvent
export const ZMockEventModel = z.object({
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    locationDescription: z.string().nullable().optional(),
    typeId: z.number().nullable().optional(),
    statusId: z.number().nullable().optional(),
    expectedAttendanceUserTagId: z.number().nullable().optional(),
    frontpageVisible: z.boolean().optional(),
    tagIds: z.array(z.number()).optional(),
}).catchall(z.any());

// TODO: compile-time check that ZMockEventModel matches MockEventModel

export const ZSaveModelMutationInput = z.object({
    eventId: z.number(),
    values: ZMockEventModel,
});


// need a mutex. db transactions are not mutexes so while the transactional integrity is protected,
// the processing won't happen in serial. it means 2 transactions can be happening at the same time,
// where for example both are processing an eventID which has no instance yet. Both transactions will create one.

// in theory this should be per instance ID or per event ID or something.
// but this is just simpler for small scale.

export const gWorkflowMutex = new Mutex();
