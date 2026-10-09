import { faker } from "@faker-js/faker";
import { LocalizedStringFormat, type BandUser, type Prisma, type BandInstrumentFunctionalGroup, type BandInstrument,
    type BandUserTag, type BandSongTag, type BandEventTag, type BandFileTag, type BandWikiPageTag } from "@prisma/client";
import { generatePublicId } from "../../src/server/publicId";
import { catalogDefinitions } from "./catalogDefinitions";
import type { SeedPlatformCatalogs } from "./catalogs";
import { seedLabels, seedLocalizedString, type SeedLocale } from "./localization";
import type { SeedPeople } from "./people";
import { choose, probability, subset } from "./random";

export interface SeedMember extends BandUser { instrumentIds: number[]; }

async function seedBandCatalogs(db: Prisma.TransactionClient, bandId: number, platform: SeedPlatformCatalogs,
    locales: ReadonlyMap<SeedLocale, number>, index: number) {
    const groups: BandInstrumentFunctionalGroup[] = [];
    for (const global of platform.groups) {
        groups.push(await db.bandInstrumentFunctionalGroup.create({ data: {
            publicId: generatePublicId<"BandInstrumentFunctionalGroup">(), bandId, globalFunctionalGroupId: global.id,
        } }));
    }
    const instruments: BandInstrument[] = [];
    for (const global of platform.instruments) {
        instruments.push(await db.bandInstrument.create({ data: {
            publicId: generatePublicId<"BandInstrument">(), bandId, globalInstrumentId: global.id,
            functionalGroupId: groups.find(group => group.globalFunctionalGroupId === global.functionalGroupId)!.id,
        } }));
    }
    const userTags: BandUserTag[] = [];
    for (const global of platform.userTags) {
        userTags.push(await db.bandUserTag.create({ data: { publicId: generatePublicId<"BandUserTag">(), bandId, globalUserTagId: global.id } }));
    }
    const songTags: BandSongTag[] = [];
    for (const global of platform.songTags) {
        songTags.push(await db.bandSongTag.create({ data: { publicId: generatePublicId<"BandSongTag">(), bandId, globalSongTagId: global.id } }));
    }
    const eventTags: BandEventTag[] = [];
    for (const global of platform.eventTags) {
        eventTags.push(await db.bandEventTag.create({ data: { publicId: generatePublicId<"BandEventTag">(), bandId, globalEventTagId: global.id } }));
    }
    const fileTags: BandFileTag[] = [];
    for (const global of platform.fileTags) {
        fileTags.push(await db.bandFileTag.create({ data: { publicId: generatePublicId<"BandFileTag">(), bandId, globalFileTagId: global.id } }));
    }
    const wikiTags: BandWikiPageTag[] = [];
    for (const global of platform.wikiTags) {
        wikiTags.push(await db.bandWikiPageTag.create({ data: { publicId: generatePublicId<"BandWikiPageTag">(), bandId, globalWikiPageTagId: global.id } }));
    }
    // Local rows and property overrides coexist with the unmodified inherited catalogs.
    instruments.push(await db.bandInstrument.create({ data: {
        publicId: generatePublicId<"BandInstrument">(), bandId, functionalGroupId: groups[0]!.id,
        ...await seedLabels(db, locales, { "en-US": `Guest instrument ${index + 1}`, "fr-BE": "Instrument invité", "nl-BE": "Gastinstrument" }, { "en-US": "A band-local instrument" }),
        sortOrder: 501, autoAssignFileLeafRegex: "guest",
    } }));
    songTags.push(await db.bandSongTag.create({ data: {
        publicId: generatePublicId<"BandSongTag">(), bandId, isHidden: true,
        ...await seedLabels(db, locales, { "en-US": "Archived repertoire", "fr-BE": "Ancien répertoire", "nl-BE": "Oud repertoire" }, { "en-US": "Band-local repertoire" }),
    } }));
    if (index % 2 === 1) {
        await db.bandInstrumentFunctionalGroup.update({ where: { id: groups[0]!.id }, data: { color: "blue", sortOrder: 1 } });
    }
    const trumpetIndex = catalogDefinitions.instrument.findIndex(instrument => instrument.name === "Trumpet");
    const trumpet = platform.instruments[trumpetIndex]!;
    if (index === 0 && locales.has("fr-BE")) {
        await db.bandDynamicLocalizedStringValue.createMany({ data: [
            { publicId: generatePublicId<"BandDynamicLocalizedStringValue">(), bandId, localeId: locales.get("fr-BE")!, stringId: trumpet.nameId, indexedValue: "Cornet de la fanfare" },
            { publicId: generatePublicId<"BandDynamicLocalizedStringValue">(), bandId, localeId: locales.get("fr-BE")!, stringId: trumpet.descriptionId, blobValue: "" },
        ] });
    }
    return { groups, instruments, userTags, songTags, eventTags, fileTags, wikiTags };
}

async function seedBandChrome(db: Prisma.TransactionClient, bandId: number, publicId: string, title: string,
    locales: ReadonlyMap<SeedLocale, number>, enabledLocales: readonly SeedLocale[], index: number, managerId: number) {
    await db.bandSetting.createMany({ data: [
        ["siteCustomization.title", title], ["siteCustomization.titlePrefix", index === 0 ? "CM" : "BRASS"],
        ["siteCustomization.themeColors.primaryMain", index % 2 === 0 ? "#176b63" : "#9b4228"],
        ["dateTime.bandTimeZone", "Europe/Brussels"], ["ical.calendarName", `${title} calendar`],
        ["ical.calendarCompany", title], ["ical.calendarProduct", "CMDB Development"], ["ical.calendarEventPrefix", `${title}: `],
    ].map(([name, value]) => ({ publicId: generatePublicId<"BandSetting">(), bandId, name: name!, value: value! })) });
    for (const locale of enabledLocales) {
        const query = `bandPublicId=${publicId}&routeLocale=${locale}`;
        await db.bandStaticLocalizedStringValue.createMany({ data: [
            { publicId: generatePublicId<"BandStaticLocalizedStringValue">(), bandId, localeId: locales.get(locale)!, stringKey: "BackstageFrontpageHeaderMarkdown", blobValue: `# ${title}` },
            { publicId: generatePublicId<"BandStaticLocalizedStringValue">(), bandId, localeId: locales.get(locale)!, stringKey: "BackstageFrontpageMarkdown",
                blobValue: `[Profile](/backstage/profile?${query}) · [Events](/backstage/events?${query}) · [Songs](/backstage/songs?${query}) · [Wiki](/backstage/wiki/welcome?${query}) · [Score](/score?${query})` },
        ] });
    }
    await db.menuLink.create({ data: {
        publicId: generatePublicId<"MenuLink">(), bandId, createdByUserId: managerId,
        captionId: await seedLocalizedString(db, locales, { "en-US": "Welcome", "fr-BE": "Bienvenue", "nl-BE": "Welkom" }, LocalizedStringFormat.PlainText),
        realm: "General", applicationPage: "BackstageHome", groupName: "Band", groupCssClass: "", itemCssClass: "", linkType: "Wiki", wikiSlug: "welcome",
        visiblePermissionId: (await db.permission.findUniqueOrThrow({ where: { name: "visibility_members" } })).id,
    } });
}

export async function seedBand(db: Prisma.TransactionClient, platform: SeedPlatformCatalogs, people: SeedPeople,
    locales: ReadonlyMap<SeedLocale, number>, roles: ReadonlyMap<string, number>, bandCount: number, index: number) {
    const title = index === 0 ? "Café Marché" : index === 1 ? "Harbour Brass" : `Ensemble ${index + 1}`;
    const nameId = await seedLocalizedString(db, locales, { "en-US": title }, LocalizedStringFormat.PlainText);
    // Fresh migrations create an empty first band. Reuse it rather than creating a stray scaffold.
    const scaffold = index === 0 ? await db.band.findFirst() : null;
    const band = scaffold ? await db.band.update({ where: { id: scaffold.id }, data: { nameId } })
        : await db.band.create({ data: { publicId: generatePublicId<"Band">(), nameId } });
    const enabledLocales = [...locales.keys()].filter(locale => index % 2 === 0 || locale !== "fr-BE");
    await db.bandLocale.deleteMany({ where: { bandId: band.id } });
    await db.bandLocale.createMany({ data: enabledLocales.map((locale, sortOrder) => ({ bandId: band.id, localeId: locales.get(locale)!, sortOrder })) });
    const catalogs = await seedBandCatalogs(db, band.id, platform, locales, index);
    const manager = people.managers[index]!;
    const members: SeedMember[] = [];
    const persons = [people.shared, manager, ...people.special, ...people.ordinary.filter((_, personIndex) => personIndex % bandCount === index)];
    for (const [personIndex, person] of persons.entries()) {
        const roleId = personIndex === 1 || people.special.some(special => special.id === person.id) || (personIndex === 0 && index === 0)
            ? roles.get("Band Admin")! : personIndex === 0 || personIndex === 5 ? roles.get("Normal Users")!
                : probability(0.05) ? null : choose([...roles.values()]);
        const member = await db.bandUser.create({ data: {
            publicId: generatePublicId<"BandUser">(), bandId: band.id, userId: person.id, bandRoleId: roleId,
        } });
        const instrumentCount = personIndex < 5 ? 3 : probability(0.08) ? 0 : faker.number.int({ min: 1, max: 3 });
        const instruments = subset(catalogs.instruments, instrumentCount, instrumentCount);
        const primary = instruments.length ? faker.number.int({ min: 0, max: instruments.length - 1 }) : -1;
        await db.bandUserInstrument.createMany({ data: instruments.map((instrument, instrumentIndex) => ({
            publicId: generatePublicId<"BandUserInstrument">(), bandUserId: member.id, bandInstrumentId: instrument.id, isPrimary: instrumentIndex === primary,
        })) });
        await db.bandUserTagAssignment.createMany({ data: subset(catalogs.userTags, 0, catalogs.userTags.length).map(tag => ({
            publicId: generatePublicId<"BandUserTagAssignment">(), bandUserId: member.id, bandUserTagId: tag.id,
        })) });
        await db.bandUserSetting.create({ data: { bandUserId: member.id, name: "calendar.locale", value: choose(enabledLocales) } });
        members.push({ ...member, instrumentIds: instruments.map(instrument => instrument.id) });
    }
    await seedBandChrome(db, band.id, band.publicId, title, locales, enabledLocales, index, manager.id);
    return { ...catalogs, band, title, manager, members, locales: enabledLocales, timeZone: "Europe/Brussels" };
}

export type SeedBand = Awaited<ReturnType<typeof seedBand>>;
