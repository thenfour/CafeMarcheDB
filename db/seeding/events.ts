import { faker } from '@faker-js/faker';
import { Prisma } from '@prisma/client';
import { DateTimeRange, roundToNearest15Minutes } from '../../shared/time';
import { SeedingState } from './base';
//import { EventTypeSignificance } from 'src/core/db3/db3';

// Define arrays of words for event names
const adjectives = [
    'Grand', 'Epic', 'Legendary', 'Mystic', 'Electric', 'Harmonic', 'Vibrant', 'Groovy', 'Classic', 'Fusion', 'Ultimate',
    'Spectacular', 'Fantastic', 'Majestic', 'Radiant', 'Funky', 'Sonic', 'Blissful', 'Luminous', 'Dynamic', 'Extravagant',
    'Marvelous', 'Brilliant', 'Phenomenal', 'Magical', 'Enchanting', 'Energetic', 'Astounding', 'Remarkable'
];

const nouns = [
    'Festival', 'Concert', 'Party', 'Celebration', 'Gathering', 'Show', 'Extravaganza', 'Fiesta', 'Carnival', 'Gala',
    'Bash', 'Rave', 'Hoedown', 'Jubilee', 'Feast', 'Fair', 'Soiree', 'Meetup', 'Symphony', 'Ball', 'Recital', 'Session',
    'Performance', 'Function', 'Revelry', 'Ceremony', 'Blowout', 'Mixer', 'Slam'
];

const locations = [
    'Beach', 'Park', 'Hall', 'Arena', 'Center', 'Stadium', 'Plaza', 'Club', 'Garden', 'Ballroom', 'Theater', 'Auditorium',
    'Lounge', 'Pavilion', 'Court', 'Grounds', 'Field', 'Terrace', 'Rooftop', 'Boulevard', 'Promenade', 'Deck', 'Lawn',
    'Dome', 'Amphitheater'
];

const occasions = [
    'Wedding', 'Anniversary', 'Birthday', 'Reunion', 'Farewell', 'Welcome', 'Fundraiser', 'Charity', 'Launch', 'Opening',
    'Closing', 'Commemoration', 'Homecoming', 'Ceremony', 'Kickoff', 'Reception', 'Banquet', 'Gala', 'Gathering', 'Festival',
    'Showcase', 'Spectacle', 'Presentation', 'Bash', 'Picnic', 'Outing', 'Retreat', 'Convention', 'Symposium'
];

const prefixes = [
    'C\'est Pas de la', 'Le Grand', 'Mega', 'Ultra', 'The Annual', 'The Ultimate', 'The One and Only', 'The Legendary',
    'Super', 'Fantastic', 'Amazing', 'Incredible', 'The First Annual', 'The Grand', 'The Supreme', 'The Iconic', 'The Prestigious',
    'The Renowned', 'The Famous', 'The Celebrated', 'The Illustrious', 'The Notorious', 'The Historic', 'The Unforgettable',
    'The Magnificent', 'The Colossal', 'The Prodigious'
];

const suffixes = [
    '(Pre-show)', '(After Party)', '(Exclusive)', '(Free Entry)', '(VIP Only)', '(Open Air)', '(Live)', '(Special Edition)',
    '(Members Only)', '(Encore)', '(Matinee)', '(Late Night)', '(Festival Edition)', '(Charity Event)', '(Fundraiser)', '(Benefit)',
    '(Special Appearance)', '(One Night Only)', '(Tour)', '(Summer Edition)', '(Winter Edition)', '(Spring Fling)', '(Autumn Affair)',
    '(Gala Event)', '(Featuring Guest Artists)', '(With Special Guests)', '(Under the Stars)', '(Limited Tickets)'
];

function generateEventName(): string {
    const adjective = faker.helpers.arrayElement(adjectives);
    const noun = faker.helpers.arrayElement(nouns);
    const location = faker.helpers.arrayElement(locations);
    const occasion = faker.helpers.arrayElement(occasions);
    const prefix = faker.helpers.arrayElement(prefixes);
    const suffix = faker.helpers.arrayElement(suffixes);

    const formats = [
        `${adjective} ${noun}`,
        `${adjective} ${noun} at the ${location}`,
        `${adjective} ${noun} for ${occasion}`,
        `${noun} at the ${location}`,
        `${noun} for ${occasion}`,
        `${adjective} ${occasion} ${noun}`,
        `${prefix} ${noun}`,
        `${prefix} ${noun} at the ${location}`,
        `${prefix} ${occasion} ${noun}`,
        `${adjective} ${noun} ${suffix}`,
        `${noun} at the ${location} ${suffix}`,
        `${prefix} ${noun} ${suffix}`
    ];

    return faker.helpers.arrayElement(formats);
}


const MakeEvent = async (gState: SeedingState, eventName: string, typeId: number | null, segmentDateRanges: DateTimeRange[]) => {

    // create things out of order.
    segmentDateRanges = faker.helpers.shuffle(segmentDateRanges);
    let eventRange = new DateTimeRange({ durationMillis: 0, isAllDay: false, startsAtDateTime: null });
    segmentDateRanges.forEach(r => {
        //console.log(` + (${r.toString()}`);
        eventRange = eventRange.unionWith(r);
    });
    //console.log(`= ${eventRange.toString()}`);

    const visibilityPermissionId = gState.randomVisibilityPermissionId();
    const event = await gState.prisma.event.create({
        data: {
            name: eventName,
            revision: 0,
            expectedAttendanceUserTagId: faker.datatype.boolean(0.8) ? faker.helpers.arrayElement(gState.gAllUserTags).id : null,
            calendarInputHash: faker.string.uuid(),
            uid: faker.string.uuid(),
            createdAt: new Date(),
            visiblePermissionId: visibilityPermissionId,
            typeId,//: faker.datatype.boolean(0.3) ? null : faker.helpers.arrayElement(gState.gAllEventTypes).id,
            statusId: faker.helpers.arrayElement([null, ...gState.gAllEventStatuses.map(i => i.id)]),
            locationDescription: faker.datatype.boolean(0.5) ? undefined : faker.location.streetAddress(),

            startsAt: eventRange.getSpec().startsAtDateTime,
            durationMillis: eventRange.getSpec().durationMillis,
            isAllDay: eventRange.getSpec().isAllDay,
            endDateTime: eventRange.getEndDateTime(),

            frontpageVisible: faker.datatype.boolean(0.5),
        }
    });

    // create description wiki
    if (faker.datatype.boolean(0.5)) {
        const wp = await gState.prisma.wikiPage.create({
            data: {
                slug: `EventDescription/${event.id}`,
                namespace: 'eventdescription',
                visiblePermissionId: visibilityPermissionId,
                revisions: {
                    create: {
                        content: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 5 })),
                        createdAt: new Date(),
                        name: `(description for event #${event.id} ${event.name})`,
                    }
                }
            }
        });

        await gState.prisma.event.update({
            where: { id: event.id },
            data: {
                descriptionWikiPageId: wp.id,
            }
        });
    }

    const tags = faker.helpers.arrayElements(gState.gAllEventTags);
    await tags.forEach(async (tag) => {
        await gState.prisma.eventTagAssignment.create({
            data: {
                eventTagId: tag.id,
                eventId: event.id,
            }
        });
    });

    // segments
    const segments: Prisma.EventSegmentGetPayload<{}>[] = [];
    for (let ii = 0; ii < segmentDateRanges.length; ++ii) {

        // generate a random datetime span. whew.
        const range = segmentDateRanges[ii]!;

        const seg = await gState.prisma.eventSegment.create({
            data: {
                description: faker.datatype.boolean(0.15) ? faker.lorem.paragraph() : "",
                startsAt: range.getSpec().startsAtDateTime,
                durationMillis: range.getSpec().durationMillis,
                isAllDay: range.getSpec().isAllDay,
                name: `Set ${faker.lorem.word()}`,
                eventId: event.id,
            }
        });

        segments.push(seg);
    }
    // song lists
    const songListCount = faker.number.int({ max: 2 });
    for (let ii = 0; ii < songListCount; ++ii) {

        const songList = await gState.prisma.eventSongList.create({
            data: {
                name: `Setlist ${faker.lorem.word()}`,
                description: faker.datatype.boolean(0.15) ? faker.lorem.paragraph() : "",
                eventId: event.id,
                sortOrder: ii,
            }
        });

        const songCount = faker.datatype.boolean(0.1) ? 0 : faker.number.int({ min: 1, max: 40 });

        // Create a combined list of songs and dividers
        const items: any[] = [];
        let sortOrder = 0;

        for (let iii = 0; iii < songCount; ++iii) {

            // Randomly decide to insert a divider before the song
            if (faker.datatype.boolean(0.1)) {
                // Add a divider
                items.push({
                    type: 'divider',
                    data: {
                        eventSongListId: songList.id,
                        sortOrder: sortOrder++,
                        subtitle: faker.datatype.boolean(0.5) ? faker.lorem.words() : '', // Optional subtitle
                        isSong: faker.datatype.boolean(),
                        lengthSeconds: faker.datatype.boolean() ? null : faker.number.int({ min: 30, max: 300 }),
                        subtitleIfSong: faker.datatype.boolean(0.5) ? faker.lorem.sentence({ min: 1, max: 5 }) : undefined,
                    }
                });
            }

            // Add a song
            items.push({
                type: 'song',
                data: {
                    eventSongListId: songList.id,
                    songId: faker.helpers.arrayElement(gState.gAllSongs).id,
                    sortOrder: sortOrder++,
                    subtitle: faker.datatype.boolean(0.1) ? faker.lorem.sentence() : undefined,
                }
            });
        }

        // Optionally add a divider at the end
        if (faker.datatype.boolean(0.1)) {
            items.push({
                type: 'divider',
                data: {
                    eventSongListId: songList.id,
                    sortOrder: sortOrder++,
                    subtitle: faker.datatype.boolean(0.5) ? faker.lorem.words() : '',
                    isSong: faker.datatype.boolean(),
                    lengthSeconds: faker.datatype.boolean() ? null : faker.number.int({ min: 30, max: 300 }),
                    subtitleIfSong: faker.datatype.boolean(0.5) ? faker.lorem.sentence({ min: 1, max: 5 }) : undefined,
                }
            });
        }

        // Insert the items into the database
        for (const item of items) {
            if (item.type === 'song') {
                await gState.prisma.eventSongListSong.create({
                    data: item.data
                });
            } else if (item.type === 'divider') {
                await gState.prisma.eventSongListDivider.create({
                    data: item.data
                });
            }
        }

    } // create song lists

    // generate event & segment user responses.
    let userList: Prisma.UserGetPayload<{}>[] = [];
    const userListStyle = faker.number.int({ max: 3 }); // 0 1 2 3
    switch (userListStyle) {
        case 0:
            // no users.
            break;
        case 1:
            // few users
            userList = faker.helpers.arrayElements(gState.gAllUsers, { min: 1, max: gState.config.userCount * 0.1 });
        case 2:
            // many users
            userList = faker.helpers.arrayElements(gState.gAllUsers, { min: gState.config.userCount * .8, max: gState.config.userCount });
        case 3:
            // all users
            userList = [...gState.gAllUsers];
            break;
    }

    const users = faker.helpers.arrayElements(gState.gAllUsers);
    users.forEach(async (u, ui) => {
        await gState.prisma.eventUserResponse.create({
            data: {
                eventId: event.id,
                userId: u.id,
                instrumentId: faker.datatype.boolean(0.15) ? faker.helpers.arrayElement(gState.gAllInstruments).id : null,
                isInvited: faker.datatype.boolean(0.5),
                userComment: faker.datatype.boolean(0.05) ? faker.lorem.sentence() : undefined,
            }
        });

        // segment responses.
        const segmentsToRespondToStyle = faker.number.int({ max: 3 }); // 0 1 2 3
        let segmentsToRespondTo: Prisma.EventSegmentGetPayload<{}>[] = [];// = faker.helpers.arrayElements(segments);
        switch (segmentsToRespondToStyle) {
            case 0:
                // no segments.
                break;
            case 1:
                // some
                segmentsToRespondTo = faker.helpers.arrayElements(segments);
            case 2:
                // all
                segmentsToRespondTo = [...segments];
                break;
        }

        segmentsToRespondTo.forEach(async (seg, si) => {
            await gState.prisma.eventSegmentUserResponse.create({
                data: {
                    userId: u.id,
                    eventSegmentId: seg.id,
                    attendanceId: faker.helpers.arrayElement([...gState.gAllAttendanceOptions, null])?.id || null,
                }
            });
        });
    });

    // files
    const fileCount = faker.datatype.boolean(0.5) ? 0 : faker.number.int({ max: 12 });
    for (let j = 0; j < fileCount; ++j) {
        const file = await gState.FakeFile(gState.randomVisibilityPermissionId());
        await gState.prisma.fileEventTag.create({
            data: {
                fileId: file.id,
                eventId: event.id,
            }
        });
    }

};





interface EventSeedingConfig {
    minDate: Date;
    maxDate: Date;
}

interface Event {
    name: string;
    typeId: number | null;
    segments: DateTimeRange[];
}

function randomDateInRange(minDate: Date, maxDate: Date): Date {
    const minTime = minDate.getTime();
    const maxTime = maxDate.getTime();
    return new Date(minTime + Math.random() * (maxTime - minTime));
}

function generateRandomSegments(config: EventSeedingConfig): DateTimeRange[] {
    const segments: DateTimeRange[] = [];
    const segmentCount = faker.number.int({ min: 0, max: 4 });

    let lastEndDate: Date | null = null;
    for (let i = 0; i < segmentCount; i++) {
        const isAllDay = faker.datatype.boolean(0.3);
        const isTBD = faker.datatype.boolean(0.1);
        let s = new DateTimeRange({ durationMillis: 0, isAllDay: false, startsAtDateTime: null });
        if (!isTBD) {

            let startsAt: Date;
            if (lastEndDate) {
                // Start after the last segment, within a reasonable time frame
                startsAt = new Date(lastEndDate.getTime() + faker.number.int({ min: 15, max: 120 }) * 60 * 1000);
            } else {
                // Start at a random time within the date range
                startsAt = randomDateInRange(config.minDate, config.maxDate);
                startsAt = roundToNearest15Minutes(startsAt);
            }

            const durationMillis = isAllDay
                ? faker.number.int({ min: 1, max: 3 }) * 24 * 60 * 60 * 1000 // 1 to 3 days in milliseconds
                : faker.number.int({ min: 1, max: 8 }) * 60 * 60 * 1000; // 1 to 8 hours in milliseconds

            // Update lastEndDate for the next segment
            lastEndDate = new Date(startsAt.getTime() + durationMillis);

            s = new DateTimeRange({
                durationMillis,
                isAllDay,
                startsAtDateTime: startsAt,
            });

        }
        //console.log(`= ${s.toString()}`);

        segments.push(s);
    }

    return segments;
}


function GenerateEventsAndSegments(gState: SeedingState, config: EventSeedingConfig): Event[] {
    const events: Event[] = [];
    const rehearsalType = gState.gAllEventTypes.find(i => i.significance === "Rehearsal")!;

    const totalMonths = (config.maxDate.getFullYear() - config.minDate.getFullYear()) * 12 +
        (config.maxDate.getMonth() - config.minDate.getMonth());
    const totalEvents = totalMonths * 5; // 5 events per month on average

    // Generate regular events
    for (let i = 0; i < totalEvents; i++) {
        events.push({
            segments: generateRandomSegments(config),
            name: generateEventName(),
            typeId: faker.helpers.arrayElement([null, ...(gState.gAllEventTypes.map(i => i.id))]),
        });
    }

    // Generate rehearsals (every Thursday)
    let currentDate = new Date(config.minDate);
    while (currentDate <= config.maxDate) {
        if (currentDate.getDay() === 4) { // Thursday
            const rehearsalStart = new Date(currentDate);
            rehearsalStart.setHours(20, 0, 0, 0); // Start at 20:00

            events.push({
                segments: [new DateTimeRange({
                    isAllDay: false,
                    startsAtDateTime: rehearsalStart,
                    durationMillis: 2 * 60 * 60 * 1000 // 2 hours in milliseconds
                })],
                name: "Rehearsal",
                typeId: rehearsalType.id,
            });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return events;
}



export const SeedEvents_VeryRandom = async (gState: SeedingState) => {

    let eventDates = GenerateEventsAndSegments(gState, gState.config.events);
    console.log(`creating ${eventDates.length} events...`);

    eventDates = faker.helpers.shuffle(eventDates);

    for (const [i, e] of eventDates.entries()) {
        console.log(`creating event #${i} ${e.name}`);

        await MakeEvent(gState, e.name, e.typeId, e.segments);
    }

    gState.gAllEvents = await gState.prisma.event.findMany({});
};


