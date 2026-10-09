import { faker } from "@faker-js/faker";
import { Temporal } from "@js-temporal/polyfill";
import type { Event, EventSegment, Prisma, Song } from "@prisma/client";
import { CalendarDate, bandDateTimeToInstant } from "../../shared/dateTimePolicy";
import { DateTimeRange, createAllDayRange, roundToNearest15Minutes } from "../../shared/time";
import { generatePublicId } from "../../src/server/publicId";
import { calculateEventDateBoundsUpdatePatch } from "../../src/server/dateTime";
import { randomVisibilityPermissionId, type SeedingState } from "./base";
import { generateEventName } from "./eventNames";
import { choose, probability, randomDate, subset } from "./random";
import { seedWikiPage } from "./wikiPageSeeding";
import { seedFile } from "./files";

export function seedEventWindow(state: Pick<SeedingState, "now" | "config" | "band">) {
    const today = CalendarDate.fromInstant({ value: state.now, timeZone: state.band.timeZone });
    const anchor = Temporal.PlainDate.from(today.date);
    const first = new CalendarDate(anchor.subtract({ months: state.config.monthsBeforeNow }).toString(), today.timeZone);
    const last = new CalendarDate(anchor.add({ months: state.config.monthsAfterNow }).toString(), today.timeZone);
    return { first, last };
}

function randomSegments(state: SeedingState): DateTimeRange[] {
    const { first, last } = seedEventWindow(state);
    const ranges: DateTimeRange[] = [];
    const count = faker.number.int({ min: 0, max: 4 });
    let previousEnd: Date | null = null;
    for (let index = 0; index < count; index++) {
        if (probability(0.1)) {
            ranges.push(new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: false }));
            continue;
        }
        const startsAt = previousEnd ? new Date(previousEnd.valueOf() + faker.number.int({ min: 15, max: 120 }) * 60_000)
            : roundToNearest15Minutes(randomDate(first.toStartInstant(), last.toStartInstant()));
        let range: DateTimeRange;
        if (probability(0.3)) {
            let date = CalendarDate.fromInstant({ value: startsAt, timeZone: state.band.timeZone });
            // An all-day start must not move backwards into the previous segment.
            if (previousEnd && date.toStartInstant() < previousEnd) {
                date = date.addDays(1);
            }
            range = createAllDayRange({ startDate: date.date, endDateExclusive: date.addDays(faker.number.int({ min: 1, max: 3 })).date }, state.band.timeZone);
        } else {
            range = new DateTimeRange({ startsAtDateTime: startsAt, durationMillis: faker.number.int({ min: 1, max: 8 }) * 3_600_000, isAllDay: false });
        }
        previousEnd = range.getEndDateTime();
        ranges.push(range);
    }
    return faker.helpers.shuffle(ranges);
}

interface SeedEventDefinition { name: string; typeId: number | null; ranges: DateTimeRange[]; }

function eventDefinitions(state: SeedingState): SeedEventDefinition[] {
    const { first, last } = seedEventWindow(state);
    const result: SeedEventDefinition[] = [];
    const count = (state.config.monthsBeforeNow + state.config.monthsAfterNow) * 5;
    for (let index = 0; index < count; index++) {
        result.push({ name: generateEventName(), typeId: choose([null, ...state.platform.eventTypes.map(type => type.id)]), ranges: randomSegments(state) });
    }
    const rehearsal = state.platform.eventTypes.find(type => type.significance === "Rehearsal")!;
    for (let date = first; date.date <= last.date; date = date.addDays(1)) {
        if (Temporal.PlainDate.from(date.date).dayOfWeek !== 4) {
            continue;
        }
        result.push({ name: "Rehearsal", typeId: rehearsal.id, ranges: [new DateTimeRange({
            startsAtDateTime: bandDateTimeToInstant({ date: date.date, time: "20:00" }, state.band.timeZone),
            durationMillis: 2 * 3_600_000, isAllDay: false,
        })] });
    }
    return faker.helpers.shuffle(result);
}

async function seedSetlists(state: SeedingState, event: Event, songs: readonly Song[]): Promise<void> {
    const count = faker.number.int({ min: 0, max: 2 });
    for (let index = 0; index < count; index++) {
        const list = await state.db.eventSongList.create({ data: {
            publicId: generatePublicId<"EventSongList">(), eventId: event.id, name: `Setlist ${faker.lorem.word()}`, sortOrder: index,
            description: probability(0.15) ? faker.lorem.paragraph() : "", isOrdered: probability(0.9), isActuallyPlayed: probability(0.5),
        } });
        const items: Prisma.EventSongListSongCreateManyInput[] = [];
        const dividers: Prisma.EventSongListDividerCreateManyInput[] = [];
        let sortOrder = 0;
        const addDivider = () => dividers.push({ publicId: generatePublicId<"EventSongListDivider">(), eventSongListId: list.id,
            sortOrder: sortOrder++, subtitle: probability(0.5) ? faker.lorem.words() : "", isSong: probability(0.5),
            lengthSeconds: probability(0.5) ? faker.number.int({ min: 30, max: 300 }) : null,
            subtitleIfSong: probability(0.5) ? faker.lorem.sentence() : null });
        const songCount = !songs.length || probability(0.1) ? 0 : faker.number.int({ min: 1, max: 40 });
        for (let songIndex = 0; songIndex < songCount; songIndex++) {
            if (probability(0.1)) {
                addDivider();
            }
            items.push({ publicId: generatePublicId<"EventSongListSong">(), eventSongListId: list.id,
                songId: choose(songs).id, sortOrder: sortOrder++, subtitle: probability(0.1) ? faker.lorem.sentence() : null });
        }
        if (probability(0.1)) {
            addDivider();
        }
        await state.db.eventSongListSong.createMany({ data: items });
        await state.db.eventSongListDivider.createMany({ data: dividers });
    }
}

async function seedAttendance(state: SeedingState, event: Event, segments: readonly EventSegment[]): Promise<void> {
    const members = state.band.members;
    const style = faker.number.int({ min: 0, max: 3 });
    const respondents = style === 0 ? [] : style === 1 ? subset(members, 1, Math.max(1, Math.floor(members.length * 0.1)))
        : style === 2 ? subset(members, Math.floor(members.length * 0.8), members.length) : members;
    const responses: Prisma.EventUserResponseCreateManyInput[] = [];
    const attendance: Prisma.EventSegmentUserResponseCreateManyInput[] = [];
    for (const member of respondents) {
        responses.push({ publicId: generatePublicId<"EventUserResponse">(), eventId: event.id, bandUserId: member.id,
            bandInstrumentId: probability(0.15) ? choose(state.band.instruments).id : null,
            isInvited: probability(0.5), userComment: probability(0.05) ? faker.lorem.sentence() : null });
        const segmentStyle = faker.number.int({ min: 0, max: 2 });
        const answered = segmentStyle === 0 ? [] : segmentStyle === 1 ? subset(segments, 0, segments.length) : segments;
        for (const segment of answered) {
            attendance.push({ publicId: generatePublicId<"EventSegmentUserResponse">(), bandUserId: member.id, eventSegmentId: segment.id,
                attendanceId: choose([null, ...state.platform.attendance.map(option => option.id)]), createdByUserId: member.userId });
        }
    }
    await state.db.eventUserResponse.createMany({ data: responses });
    await state.db.eventSegmentUserResponse.createMany({ data: attendance });
}

async function seedEvent(state: SeedingState, definition: SeedEventDefinition, songs: readonly Song[]): Promise<Event> {
    const visibility = randomVisibilityPermissionId(state);
    const event = await state.db.event.create({ data: {
        publicId: generatePublicId<"Event">(), bandId: state.band.band.id, revision: 0, name: definition.name, typeId: definition.typeId,
        statusId: choose([null, ...state.platform.eventStatuses.map(status => status.id)]), visiblePermissionId: visibility,
        createdByUserId: choose(state.band.members).userId,
        expectedAttendanceUserTagId: probability(0.8) ? choose(state.band.userTags).id : null,
        locationDescription: probability(0.5) ? faker.location.streetAddress() : "", frontpageVisible: probability(0.5),
    } });
    const segments: EventSegment[] = [];
    for (const range of definition.ranges) {
        const spec = range.getSpec();
        segments.push(await state.db.eventSegment.create({ data: {
            publicId: generatePublicId<"EventSegment">(), eventId: event.id, name: `Set ${faker.lorem.word()}`,
            description: probability(0.15) ? faker.lorem.paragraph() : "", startsAt: spec.startsAtDateTime,
            durationMillis: BigInt(spec.durationMillis), isAllDay: spec.isAllDay, dateTimeVersion: 2,
            statusId: probability(0.2) ? choose(state.platform.eventStatuses).id : null,
        } }));
    }
    const cancelled = state.platform.eventStatuses.filter(status => status.significance === "Cancelled").map(status => status.id);
    const bounds = await calculateEventDateBoundsUpdatePatch(state.db, event.id, cancelled);
    let descriptionWikiPageId: number | null = null;
    if (probability(0.5)) {
        descriptionWikiPageId = (await seedWikiPage(state, `EventDescription/${event.publicId}`, visibility,
            `(description for ${event.name})`, faker.lorem.paragraphs(faker.number.int({ min: 1, max: 5 })), 1)).id;
    }
    await state.db.eventTagAssignment.createMany({ data: subset(state.band.eventTags, 0, state.band.eventTags.length).map(tag => ({
        publicId: generatePublicId<"EventTagAssignment">(), eventId: event.id, bandEventTagId: tag.id,
    })) });
    await seedSetlists(state, event, songs);
    await seedAttendance(state, event, segments);
    const fileCount = probability(0.5) ? 0 : faker.number.int({ min: 0, max: 12 });
    for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
        const file = await seedFile(state, randomVisibilityPermissionId(state), { assetIndex: null, isDeleted: probability(0.8), name: faker.lorem.words({ min: 1, max: 6 }) });
        await state.db.fileEventTag.create({ data: { publicId: generatePublicId<"FileEventTag">(), fileId: file.id, eventId: event.id } });
    }
    return state.db.event.update({ where: { id: event.id }, data: { ...bounds, descriptionWikiPageId } });
}

export async function seedEvents(state: SeedingState, songs: readonly Song[]): Promise<Event[]> {
    const events: Event[] = [];
    for (const definition of eventDefinitions(state)) {
        events.push(await seedEvent(state, definition, songs));
    }
    return events;
}
