import type { BandFileTag, BandInstrument, BandUser, Prisma, User } from "@prisma/client";
import { demoChoice, demoDateBetween, demoDaysAgo, type DemoLocale } from "./config";
import { createDemoString, type DemoContext } from "./context";
import type { DemoCatalogs } from "./catalogs";

export async function createDemoPerson(c: DemoContext, key: string, name: string, email: string,
    hashedPassword: string, globalRoleId?: number) {
    const createdAt = demoDateBetween(c.config, `person:${key}`, demoDaysAgo(c.config, 5 * 365), demoDaysAgo(c.config, 3 * 365));
    return c.db.user.create({ data: { publicId: c.id(`person:${key}`), name, email, hashedPassword, globalRoleId,
        createdAt, signInMethods: { create: { publicId: c.id(`sign-in:${key}`), type: "email", identifier: email, createdAt } } } });
}

async function seedBandCatalogs(c: DemoContext, bandId: number, key: string, catalogs: DemoCatalogs) {
    const groups = new Map<number, number>();
    for (const global of catalogs.groups) {
        const row = await c.db.bandInstrumentFunctionalGroup.create({ data: {
            publicId: c.id(`${key}:group:${global.id}`), bandId, globalFunctionalGroupId: global.id,
        } });
        groups.set(global.id, row.id);
    }
    const instruments: BandInstrument[] = [];
    for (const [index, global] of catalogs.instruments.entries()) {
        instruments.push(await c.db.bandInstrument.create({ data: {
            publicId: c.id(`${key}:instrument:${index}`), bandId, globalInstrumentId: global.id,
            functionalGroupId: groups.get(global.functionalGroupId)!,
        } }));
    }
    const memberTag = await c.db.bandUserTag.create({ data: {
        publicId: c.id(`${key}:member-tag`), bandId, globalUserTagId: catalogs.memberTag.id,
    } });
    const songTag = await c.db.bandSongTag.create({ data: {
        publicId: c.id(`${key}:song-tag`), bandId, globalSongTagId: catalogs.songTag.id,
    } });
    const hiddenSongTag = await c.db.bandSongTag.create({ data: {
        publicId: c.id(`${key}:hidden-song-tag`), bandId, isHidden: true,
        nameId: await createDemoString(c, `${key}:hidden-song-tag:name`, { "en-US": "Archived repertoire", "fr-BE": "Ancien répertoire", "nl-BE": "Oud repertoire" }),
    } });
    const eventTag = await c.db.bandEventTag.create({ data: {
        publicId: c.id(`${key}:event-tag`), bandId, globalEventTagId: catalogs.eventTag.id,
    } });
    const fileTags: BandFileTag[] = [];
    for (const [index, global] of catalogs.fileTags.entries()) {
        fileTags.push(await c.db.bandFileTag.create({ data: {
            publicId: c.id(`${key}:file-tag:${index}`), bandId, globalFileTagId: global.id,
        } }));
    }
    return { instruments, memberTag, songTag, hiddenSongTag, eventTag, fileTags };
}

async function seedBandSettings(c: DemoContext, bandId: number, key: string, title: string, index: number) {
    const settings = [
        ["siteCustomization.title", title], ["siteCustomization.titlePrefix", index === 0 ? "RIVER" : "BRASS"],
        ["siteCustomization.themeColors.primaryMain", index % 2 === 0 ? "#176b63" : "#9b4228"],
        ["dateTime.bandTimeZone", "Europe/Brussels"], ["ical.calendarName", `${title} calendar`],
        ["ical.calendarCompany", title], ["ical.calendarProduct", "CMDB Demo"], ["ical.calendarEventPrefix", `${title}: `],
    ];
    await c.db.bandSetting.createMany({ data: settings.map(([name, value]) => ({
        publicId: c.id(`${key}:setting:${name}`), bandId, name: name!, value: value!,
    })) });
}

export async function seedDemoBand(c: DemoContext, index: number, catalogs: DemoCatalogs,
    sharedPerson: Pick<User, "id" | "createdAt">, hashedPassword: string, roles: ReadonlyMap<string, number>) {
    const key = `band:${index + 1}`;
    const title = index === 0 ? "River Fanfare" : index === 1 ? "Harbour Brass" : `Demo Ensemble ${index + 1}`;
    const locales = c.config.locales.filter(tag => index % 2 === 0 || tag !== "fr-BE");
    const band = await c.db.band.create({ data: { publicId: c.id(key),
        createdAt: demoDateBetween(c.config, key, demoDaysAgo(c.config, 6 * 365), demoDaysAgo(c.config, 5 * 365)),
        nameId: await createDemoString(c, `${key}:name`, { "en-US": title }),
        locales: { create: locales.map((tag, sortOrder) => ({ localeId: c.locales.get(tag)!, sortOrder })) },
    } });
    await seedBandSettings(c, band.id, key, title, index);
    for (const tag of locales) {
        const welcome = tag === "fr-BE" ? "Bienvenue dans le groupe de démonstration." : tag === "nl-BE" ? "Welkom bij de demonstratieband." : "Welcome to the demo band.";
        const query = `bandPublicId=${band.publicId}&routeLocale=${tag}`;
        await c.db.bandStaticLocalizedStringValue.createMany({ data: [
            { publicId: c.id(`${key}:home-header:${tag}`), bandId: band.id, localeId: c.locales.get(tag)!,
                stringKey: "BackstageFrontpageHeaderMarkdown", blobValue: `# ${title}\n\n${welcome}` },
            { publicId: c.id(`${key}:home:${tag}`), bandId: band.id, localeId: c.locales.get(tag)!, stringKey: "BackstageFrontpageMarkdown",
                blobValue: `[Profile](/backstage/profile?${query}) · [Instruments](/backstage/instruments?${query}) · [Wiki](/backstage/wiki/welcome?${query}) · [Score](/score?${query})\n\nDemo locale: ${tag}.` },
        ] });
    }
    const scoped = await seedBandCatalogs(c, band.id, key, catalogs);
    if (index === 0 && c.locales.has("fr-BE")) {
        await c.db.bandDynamicLocalizedStringValue.createMany({ data: [
            { publicId: c.id(`${key}:trumpet-fr`), bandId: band.id, localeId: c.locales.get("fr-BE")!,
                stringId: catalogs.instruments[0]!.nameId, indexedValue: "Cornet de la fanfare" },
            { publicId: c.id(`${key}:description-blank-fr`), bandId: band.id, localeId: c.locales.get("fr-BE")!,
                stringId: catalogs.instruments[0]!.descriptionId, blobValue: "" },
        ] });
    }
    const manager = await createDemoPerson(c, `${key}:manager`, `${title} Manager`, `manager${index + 1}@demo.invalid`, hashedPassword);
    const members: Array<BandUser & { instrumentId: number }> = [];
    for (let memberIndex = 0; memberIndex < c.config.membersPerBand; memberIndex++) {
        const person = memberIndex === 0 ? sharedPerson : memberIndex === 1 ? manager : await createDemoPerson(c,
            `${key}:member:${memberIndex}`, `${title} Musician ${memberIndex - 1}`,
            `member${index + 1}-${memberIndex - 1}@demo.invalid`, hashedPassword);
        const roleName = memberIndex === 1 || (memberIndex === 0 && index === 0) ? "Band Admin"
            : memberIndex > 2 && memberIndex === c.config.membersPerBand - 1 ? "Limited Users" : "Normal Users";
        const membership = await c.db.bandUser.create({ data: {
            publicId: c.id(`${key}:membership:${memberIndex}`), userId: person.id, bandId: band.id, bandRoleId: roles.get(roleName)!,
            createdAt: demoDateBetween(c.config, `${key}:membership:${memberIndex}`,
                memberIndex === c.config.membersPerBand - 1 ? demoDaysAgo(c.config, 14) : person.createdAt,
                demoDaysAgo(c.config, memberIndex < 2 ? 2 * 365 : 0)),
        } });
        const instrument = scoped.instruments[demoChoice(c.config, `${key}:member:${memberIndex}`, scoped.instruments.length)]!;
        await c.db.bandUserInstrument.create({ data: { publicId: c.id(`${key}:member-instrument:${memberIndex}`),
            bandUserId: membership.id, bandInstrumentId: instrument.id, isPrimary: true } });
        await c.db.bandUserTagAssignment.create({ data: { publicId: c.id(`${key}:member-tag:${memberIndex}`),
            bandUserId: membership.id, bandUserTagId: scoped.memberTag.id } });
        await c.db.bandUserSetting.create({ data: {
            bandUserId: membership.id, name: "calendar.locale", value: locales[memberIndex % locales.length]! } });
        members.push({ ...membership, instrumentId: instrument.id });
    }
    return { ...scoped, band, key, title, locales, manager, members };
}

export type DemoBand = Awaited<ReturnType<typeof seedDemoBand>>;

const shellTranslations: ReadonlyArray<{ key: string; values: Partial<{ [L in DemoLocale]: string }> }> = [
    { key: "dashboard.title", values: { "fr-BE": "Accueil", "nl-BE": "Startpagina" } },
    { key: "dashboard.band.select", values: { "fr-BE": "Choisir un groupe", "nl-BE": "Kies een band" } },
    { key: "dashboard.band.platform", values: { "fr-BE": "Compte et plateforme", "nl-BE": "Account en platform" } },
    { key: "dashboard.profile", values: { "fr-BE": "Votre profil", "nl-BE": "Je profiel" } },
];

export async function seedDemoShellTranslations(c: DemoContext): Promise<void> {
    const rows: Prisma.StaticLocalizedStringValueCreateManyInput[] = [];
    for (const definition of shellTranslations) {
        for (const [tag, localeId] of c.locales) {
            const text = definition.values[tag];
            if (text !== undefined) {
                rows.push({ publicId: c.id(`static:${definition.key}:${tag}`), stringKey: definition.key, localeId, indexedValue: text });
            }
        }
    }
    await c.db.staticLocalizedStringValue.createMany({ data: rows });
}
