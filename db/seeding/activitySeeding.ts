import { faker } from '@faker-js/faker';
import { slugify } from '../../shared/rootroot';
import { ActivityFeature } from '../../src/core/db3/shared/activityTracking';
import { SeedingState } from './base';
import { GetDateMinutesFromNow } from '../../shared/time';

const kActivityIntervalMinimumMinutes = 1;
const kActivityIntervalMaximumMinutes = 180;
const kActivityLayerUserCounts = [2, 4, 100];

const SeedSingleActivity = async (gState: SeedingState, userId: number, date: Date) => {

    // get random ActivityFeature.
    const feature = faker.helpers.arrayElement([
        ActivityFeature.global_ical_digest,
        //ActivityFeature.wiki_page_view,
        ActivityFeature.song_view,
        //ActivityFeature.event_view,
        //ActivityFeature.file_download,
    ]);

    switch (feature) {
        case ActivityFeature.global_ical_digest:
            await gState.prisma.action.create({
                data: {
                    feature,
                    isClient: false,
                    userId,
                    createdAt: date,
                    uri: faker.internet.url(),
                }
            });
            return;
        // case ActivityFeature.event_ical_digest:
        //     await gState.prisma.action.create({
        //         data: {
        //             feature,
        //             isClient: false,
        //             userId,
        //             createdAt: date,
        //             uri: faker.internet.url(),
        //         }
        //     });
        //     return;
        // case ActivityFeature.wiki_page_view:
        // await gState.prisma.action.create({
        //     data: {
        //         feature,
        //         isClient: false,
        //         userId,
        //         createdAt: date,
        //         uri: 
        //     }
        // });
        // return;
        case ActivityFeature.song_view:
            const song = faker.helpers.arrayElement(gState.gAllSongs);
            await gState.prisma.action.create({
                data: {
                    feature,
                    isClient: true,
                    userId,
                    createdAt: date,
                    uri: `/backstage/song/${song.id}/${slugify(song.name)}`,
                    songId: song.id,
                }
            });
            return;
        default:
        case ActivityFeature.event_view:
        // const event = faker.helpers.arrayElement(gState.gallev);
        // await gState.prisma.action.create({
        //     data: {
        //         feature,
        //         isClient: true,
        //         userId,
        //         createdAt: date,
        //         uri: `/backstage/song/${song.id}/${slugify(song.name)}`,
        //         songId: song.id,
        //     }
        // });
        // return;
        case ActivityFeature.file_download:
            return;
    };

};

export const SeedActivityLayer = async (gState: SeedingState, userPool: (SeedingState["gAllUsers"][0])[]) => {
    const startTime = GetDateMinutesFromNow(-16 * 24 * 30); // 16 days ago
    const endTime = GetDateMinutesFromNow(0);
    let time = startTime;

    while (time < endTime) {
        // advance in time
        const intervalMinutes = faker.number.int({
            min: kActivityIntervalMinimumMinutes,
            max: kActivityIntervalMaximumMinutes,
        });
        time = new Date(time.getTime() + intervalMinutes * 60000);

        const userId = faker.helpers.arrayElement(userPool).id;
        await SeedSingleActivity(gState, userId, time);
    }
};

export const SeedActivity = async (gState: SeedingState) => {

    // create multiple "layers" of activity fakes:
    // 1. every N minutes, a random user will do a random action
    // 2. also grab 4 random users and always do actions among them.

    // first grab user pools for all layers in 1 so they are unique.
    const totalUserPoolCount = kActivityLayerUserCounts.reduce((a, b) => a + b, 0);
    const userPool = faker.helpers.arrayElements(gState.gAllUsers, { min: totalUserPoolCount, max: totalUserPoolCount });

    let poolCursor = 0;
    for (let iLayer = 0; iLayer < kActivityLayerUserCounts.length; iLayer++) {
        console.log("Seeding activity for layer ", iLayer, "with", kActivityLayerUserCounts[iLayer], "users.");
        const userCount = kActivityLayerUserCounts[iLayer]!;
        const userPoolForLayer = userPool.slice(poolCursor, poolCursor + userCount);
        poolCursor += userCount;
        // 1st layer: use 
        await SeedActivityLayer(gState, userPoolForLayer);
    }
};


