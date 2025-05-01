import { faker } from '@faker-js/faker';
import { GetDateMinutesFromNow } from '../../shared/time';
import { ActivityFeature, Browsers, DeviceClasses, DeviceInfo, OperatingSystem, PointerTypes } from '../../src/core/components/featureReports/activityTracking';
import { SeedingState } from './base';

const kActivityIntervalMinimumMinutes = 1;
const kActivityIntervalMaximumMinutes = 180;
const kActivityLayerUserCounts = [2, 4, 100];



/* -------------------------------------------------------------------------- */
/* Fixed value pools                                                          */
//const pointerOptions = ["touch", "cursor"] as const;

const resolutionOptions = [
    { width: 2280, height: 1080 }, // desktop FHD
    { width: 1920, height: 1080 }, // desktop FHD
    { width: 1366, height: 768 },  // common laptop
    { width: 1280, height: 720 },  // small notebook / landscape tablet
    { width: 1024, height: 768 },  // small notebook / landscape tablet
    { width: 390, height: 844 },  // iPhone 15 Pro portrait
] as const;

//const deviceClassOptions = ["desktop", "tablet", "phone"] as const;

//const browserOptions = ["chrome", "safari", "firefox", "edge"] as const;

//const osOptions = ["windows", "macos", "linux", "android"] as const;

const languageOptions = ["en", "nl", "fr", "de"] as const;

const localeOptions = ["en-us", "en-au", "fr-be", "nl-be", "de-ca"] as const;

const timezoneOptions = [
    "america/new_york",
    "europe/berlin",
    "asia/tokyo",
    "australia/sydney",
] as const;

/* -------------------------------------------------------------------------- */
/* Helper to optionally include a value                                       */
const maybe = <T>(value: T, includeAll: boolean): T | undefined =>
    includeAll || Math.random() < 0.5 ? value : undefined;

/* -------------------------------------------------------------------------- */
/* Main factory                                                               */
export const getRandomClientData = (): DeviceInfo => {
    const roll = Math.random();

    // 1) 33 % chance: no data at all
    if (roll < 0.33) return {};

    // 2) 33 % chance: "some" data
    const includeAll = roll > 0.66;

    const screenInfo = maybe(
        faker.helpers.arrayElement(resolutionOptions),
        includeAll,
    );

    const info: DeviceInfo = {
        pointer: maybe(faker.helpers.arrayElement(Object.values(PointerTypes)), includeAll),
        screenHeight: screenInfo?.height,
        screenWidth: screenInfo?.width,
        deviceClass: maybe(
            faker.helpers.arrayElement(Object.values(DeviceClasses)),
            includeAll,
        ),
        browser: maybe(faker.helpers.arrayElement(Object.values(Browsers)), includeAll),
        operatingSystem: maybe(faker.helpers.arrayElement(Object.values(OperatingSystem)), includeAll),
        language: maybe(faker.helpers.arrayElement(languageOptions), includeAll),
        locale: maybe(faker.helpers.arrayElement(localeOptions), includeAll),
        timezone: maybe(faker.helpers.arrayElement(timezoneOptions), includeAll),
    };

    /* Strip undefined keys so the object satisfies the Zod schema cleanly */
    return Object.fromEntries(
        Object.entries(info).filter(([, v]) => v !== undefined),
    ) as DeviceInfo;
};


const CONTEXT_PATHS = [
    // marketing
    "/marketing",
    "/marketing/campaigns",
    "/marketing/campaigns/spring-sale",
    "/marketing/campaigns/black-friday",
    "/marketing/audiences/enterprise",
    "/marketing/audiences/consumer",

    /// sales
    "/sales/leads/import",
    "/sales/leads/scoring",
    "/sales/deals/pipeline",
    "/sales/deals/won",
    "/sales/deals/lost",

    /// analytics
    "/analytics/dashboards/traffic",
    "/analytics/dashboards/conversion",
    "/analytics/reports/daily",
    "/analytics/reports/monthly",

    /// admin
    "/admin/users/create",
    "/admin/users/roles",
    "/admin/settings/billing",
    "/admin/settings/integrations",
] as const;


const SeedSingleActivity = async (gState: SeedingState, userId: number, date: Date) => {

    const clientData = getRandomClientData();

    await gState.prisma.action.create({
        data: {
            feature: faker.helpers.arrayElement(Object.values(ActivityFeature)),
            isClient: faker.datatype.boolean(),
            userId,
            createdAt: date,
            uri: faker.internet.url(),
            wikiPageId: maybe(faker.helpers.arrayElement(gState.gAllWikiPages).id, false),
            songId: maybe(faker.helpers.arrayElement(gState.gAllSongs).id, false),
            eventId: maybe(faker.helpers.arrayElement(gState.gAllEvents).id, false),

            queryText: maybe(faker.lorem.words({ min: 0, max: 2 }), false),

            context: faker.helpers.arrayElement(CONTEXT_PATHS),
            browserName: clientData.browser,
            deviceClass: clientData.deviceClass,
            pointerType: clientData.pointer,
            screenHeight: clientData.screenHeight,
            screenWidth: clientData.screenWidth,
            operatingSystem: clientData.operatingSystem,
            language: clientData.language,
            locale: clientData.locale,
            timezone: clientData.timezone,
        }
    });
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


