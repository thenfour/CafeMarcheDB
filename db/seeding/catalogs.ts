import { LocalizedStringFormat, type Prisma, type GlobalInstrumentFunctionalGroup, type GlobalInstrument,
    type GlobalSongTag, type GlobalFileTag, type GlobalEventTag, type EventType, type EventStatus,
    type EventAttendance, type SongCreditType, type GlobalUserTag, type GlobalWikiPageTag } from "@prisma/client";
import { generatePublicId } from "../../src/server/publicId";
import { catalogDefinitions } from "./catalogDefinitions";
import { seedLabels, seedLocalizedString, type SeedLocale, type SeedText } from "./localization";

// Unlisted names deliberately keep an English fallback instead of invented translations.
const translations: ReadonlyMap<string, readonly [string, string]> = new Map([
    ["Voice", ["Voix", "Stem"]], ["Flute", ["Flûte", "Fluit"]], ["Oboe", ["Hautbois", "Hobo"]],
    ["Clarinet", ["Clarinette", "Klarinet"]], ["Bass Clarinet", ["Clarinette basse", "Basklarinet"]],
    ["Trumpet", ["Trompette", "Trompet"]], ["Violin", ["Violon", "Viool"]], ["Piano", ["Piano", "Piano"]],
    ["Guitar", ["Guitare", "Gitaar"]], ["Bass guitar", ["Guitare basse", "Basgitaar"]],
    ["Snare drum", ["Caisse claire", "Snaredrum"]], ["Bass drum", ["Grosse caisse", "Grote trom"]],
    ["Percussion", ["Percussions", "Percussie"]], ["Special/other", ["Autre", "Overig"]],
    ["By Heart", ["Par cœur", "Uit het hoofd"]], ["Singer", ["Chanteur", "Zanger"]], ["Street", ["Rue", "Straat"]],
    ["Partition", ["Partition", "Partituur"]], ["Recording", ["Enregistrement", "Opname"]],
    ["Concert", ["Concert", "Concert"]], ["Meeting", ["Réunion", "Vergadering"]],
    ["Rehearsal", ["Répétition", "Repetitie"]], ["Weekend", ["Week-end", "Weekend"]],
    ["New", ["Nouveau", "Nieuw"]], ["Confirmed", ["Confirmé", "Bevestigd"]], ["Cancelled", ["Annulé", "Geannuleerd"]],
    ["Checking Attendance", ["Vérification des présences", "Aanwezigheid controleren"]], ["Finalizing", ["Finalisation", "Afronden"]],
    ["Arranger", ["Arrangeur", "Arrangeur"]], ["Composer", ["Compositeur", "Componist"]],
    ["musician", ["musicien", "muzikant"]], ["board", ["comité", "bestuur"]], ["director", ["directeur", "dirigent"]],
    ["Documentation", ["Documentation", "Documentatie"]], ["Tutorial", ["Tutoriel", "Handleiding"]],
    ["Policy", ["Règlement", "Reglement"]], ["Project", ["Projet", "Project"]], ["Archive", ["Archives", "Archief"]],
]);

export function catalogText(name: string): SeedText {
    const translated = translations.get(name);
    return { "en-US": name, ...(translated ? { "fr-BE": translated[0], "nl-BE": translated[1] } : {}) };
}

export async function seedPlatformCatalogs(db: Prisma.TransactionClient, locales: ReadonlyMap<SeedLocale, number>) {
    const labels = (name: string, description: string) => seedLabels(db, locales, catalogText(name), { "en-US": description });
    const groups: GlobalInstrumentFunctionalGroup[] = [];
    for (const { name, description, ...metadata } of catalogDefinitions.instrumentFunctionalGroup) {
        groups.push(await db.globalInstrumentFunctionalGroup.create({ data: {
            publicId: generatePublicId<"GlobalInstrumentFunctionalGroup">(), ...metadata, ...await labels(name, description),
        } }));
    }
    const instruments: GlobalInstrument[] = [];
    for (const [index, { name, description, ...metadata }] of catalogDefinitions.instrument.entries()) {
        instruments.push(await db.globalInstrument.create({ data: {
            publicId: generatePublicId<"GlobalInstrument">(), functionalGroupId: groups[index]!.id,
            // Instrument colors are supplied by their functional group in the current schema.
            sortOrder: metadata.sortOrder, autoAssignFileLeafRegex: metadata.autoAssignFileLeafRegex,
            ...await labels(name, description),
        } }));
    }
    const songTags: GlobalSongTag[] = [];
    for (const { name, description, ...metadata } of catalogDefinitions.songTag) {
        songTags.push(await db.globalSongTag.create({ data: {
            publicId: generatePublicId<"GlobalSongTag">(), ...metadata, ...await labels(name, description),
        } }));
    }
    const fileTags: GlobalFileTag[] = [];
    for (const { name, description, iconName: _icon, ...metadata } of catalogDefinitions.fileTag) {
        fileTags.push(await db.globalFileTag.create({ data: {
            publicId: generatePublicId<"GlobalFileTag">(), ...metadata, ...await labels(name, description),
        } }));
    }
    const eventTags: GlobalEventTag[] = [];
    for (const { name, description, significance: _significance, iconName: _icon, ...metadata } of catalogDefinitions.eventTag) {
        eventTags.push(await db.globalEventTag.create({ data: {
            publicId: generatePublicId<"GlobalEventTag">(), ...metadata, ...await labels(name, description),
        } }));
    }
    const eventTypes: EventType[] = [];
    for (const { name, description, ...metadata } of catalogDefinitions.eventType) {
        eventTypes.push(await db.eventType.create({ data: {
            publicId: generatePublicId<"EventType">(), ...metadata, ...await labels(name, description),
        } }));
    }
    const eventStatuses: EventStatus[] = [];
    for (const { name, description, ...metadata } of catalogDefinitions.eventStatus) {
        eventStatuses.push(await db.eventStatus.create({ data: {
            publicId: generatePublicId<"EventStatus">(), ...metadata, ...await labels(name, description),
        } }));
    }
    const attendance: EventAttendance[] = [];
    const captions = [
        { button: ["No", "Non", "Nee"], personal: ["You're not going", "Vous ne venez pas", "Je komt niet"], past: ["Absent", "Absent", "Afwezig"], personalPast: ["You were absent", "Vous étiez absent", "Je was afwezig"] },
        { button: ["Probably not", "Probablement pas", "Waarschijnlijk niet"], personal: ["You're probably not going", "Vous ne venez probablement pas", "Je komt waarschijnlijk niet"], past: ["Probably absent", "Probablement absent", "Waarschijnlijk afwezig"], personalPast: ["You were probably absent", "Vous étiez probablement absent", "Je was waarschijnlijk afwezig"] },
        { button: ["Probably", "Probablement", "Waarschijnlijk"], personal: ["You're probably going", "Vous venez probablement", "Je komt waarschijnlijk"], past: ["Probably attended", "Probablement présent", "Waarschijnlijk aanwezig"], personalPast: ["You probably attended", "Vous étiez probablement présent", "Je was waarschijnlijk aanwezig"] },
        { button: ["Yes", "Oui", "Ja"], personal: ["You're going!", "Vous venez !", "Je komt!"], past: ["Attended", "Présent", "Aanwezig"], personalPast: ["You attended", "Vous étiez présent", "Je was aanwezig"] },
    ];
    for (const [index, definition] of catalogDefinitions.eventAttendance.entries()) {
        const caption = captions[index]!;
        const text = (values: string[]): SeedText => ({ "en-US": values[0]!, "fr-BE": values[1]!, "nl-BE": values[2]! });
        const plain = (values: string[]) => seedLocalizedString(db, locales, text(values), LocalizedStringFormat.PlainText);
        attendance.push(await db.eventAttendance.create({ data: {
            publicId: generatePublicId<"EventAttendance">(), buttonCaptionId: await plain(caption.button),
            personalCaptionId: await plain(caption.personal), pastCaptionId: await plain(caption.past), personalPastCaptionId: await plain(caption.personalPast),
            descriptionId: await seedLocalizedString(db, locales, { "en-US": definition.description }, LocalizedStringFormat.Markdown),
            strength: definition.strength, sortOrder: definition.sortOrder,
            color: definition.color, iconName: definition.iconName,
        } }));
    }
    const creditTypes: SongCreditType[] = [];
    for (const { name, description, color } of catalogDefinitions.songCreditType) {
        creditTypes.push(await db.songCreditType.create({ data: {
            publicId: generatePublicId<"SongCreditType">(), color, ...await labels(name, description),
        } }));
    }
    const userTags: GlobalUserTag[] = [];
    for (const [index, name] of ["musician", "board", "director"].entries()) {
        userTags.push(await db.globalUserTag.create({ data: {
            publicId: generatePublicId<"GlobalUserTag">(), sortOrder: index * 10, color: "light_teal", ...await labels(name, ""),
        } }));
    }
    const wikiTags: GlobalWikiPageTag[] = [];
    for (const [index, [name, description, color]] of [
        ["Documentation", "Technical documentation and how-to guides", "blue"], ["Tutorial", "Step-by-step tutorials and learning materials", "green"],
        ["Policy", "Organizational policies and procedures", "orange"], ["Meeting", "Meeting notes and minutes", "purple"],
        ["Project", "Project-related pages and documentation", "red"], ["Archive", "Archived or deprecated content", "gray"],
    ].entries()) {
        wikiTags.push(await db.globalWikiPageTag.create({ data: {
            publicId: generatePublicId<"GlobalWikiPageTag">(), sortOrder: index * 10, color: color!, ...await labels(name!, description!),
        } }));
    }
    return { groups, instruments, songTags, fileTags, eventTags, eventTypes, eventStatuses, attendance, creditTypes, userTags, wikiTags };
}

export type SeedPlatformCatalogs = Awaited<ReturnType<typeof seedPlatformCatalogs>>;
