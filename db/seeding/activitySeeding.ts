import { faker } from "@faker-js/faker";
import type { Event, Prisma, Song, WikiPage } from "@prisma/client";
import { ActivityFeature, Browsers, DeviceClasses, OperatingSystem, PointerTypes, type DeviceInfo } from "../../src/core/components/featureReports/activityTracking";
import type { SeedingState } from "./base";
import { choose, probability, subset } from "./random";

export function getRandomClientData(): DeviceInfo {
    const style = faker.number.int({ min: 0, max: 2 });
    if (style === 0) {
        return {};
    }
    const maybe = <T>(value: T): T | undefined => style === 2 || probability(0.5) ? value : undefined;
    const resolution = maybe(choose([[2280, 1080], [1920, 1080], [1366, 768], [1280, 720], [1024, 768], [390, 844]]));
    return {
        browser: maybe(choose(Object.values(Browsers))), deviceClass: maybe(choose(Object.values(DeviceClasses))),
        operatingSystem: maybe(choose(Object.values(OperatingSystem))), pointer: maybe(choose(Object.values(PointerTypes))),
        screenWidth: resolution?.[0], screenHeight: resolution?.[1], language: maybe(choose(["en", "nl", "fr", "de"])),
        locale: maybe(choose(["en-us", "en-au", "fr-be", "nl-be", "de-ca"])),
        timezone: maybe(choose(["america/new_york", "europe/berlin", "asia/tokyo", "australia/sydney"])),
    };
}

export async function seedActivity(state: SeedingState, songs: readonly Song[], events: readonly Event[], pages: readonly WikiPage[]): Promise<void> {
    const members = faker.helpers.shuffle(state.band.members);
    const layers = [members.slice(0, 2), members.slice(2, 6), members.slice(6, 106)];
    for (const pool of layers) {
        if (!pool.length) {
            continue;
        }
        const actions: Prisma.ActionCreateManyInput[] = [];
        let time = state.now.valueOf() - 16 * 24 * 60 * 60_000;
        while (time < state.now.valueOf()) {
            time += faker.number.int({ min: 1, max: 180 }) * 60_000;
            if (time > state.now.valueOf()) {
                break;
            }
            const member = choose(pool);
            const locale = choose(state.band.locales);
            const client = getRandomClientData();
            const event = probability(0.5) ? subset(events, 0, 1)[0] : undefined;
            const song = probability(0.5) ? subset(songs, 0, 1)[0] : undefined;
            const page = probability(0.5) ? subset(pages, 0, 1)[0] : undefined;
            const query = `bandPublicId=${state.band.band.publicId}`;
            const uri = event ? `/backstage/event/${event.publicId}?${query}` : song ? `/backstage/song/${song.publicId}?${query}`
                : page ? `/backstage/wiki/${page.slug}?${query}` : `/backstage?${query}`;
            actions.push({ userId: member.userId, bandId: state.band.band.id, localeContextId: state.locales.get(locale),
                createdAt: new Date(time), isClient: probability(0.5), feature: choose(Object.values(ActivityFeature)), uri,
                eventId: event?.id, songId: song?.id, wikiPageId: page?.id,
                queryText: probability(0.5) ? faker.lorem.words({ min: 0, max: 2 }) : null,
                context: choose(["/backstage", "/backstage/events", "/backstage/songs", "/backstage/profile", "/backstage/wiki"]),
                browserName: client.browser, deviceClass: client.deviceClass, operatingSystem: client.operatingSystem, pointerType: client.pointer,
                screenWidth: client.screenWidth, screenHeight: client.screenHeight,
                language: client.language, locale: client.locale, timezone: client.timezone,
            });
        }
        await state.db.action.createMany({ data: actions });
    }
}
