import { LocalizedStringFormat, type EventAttendance, type EventStatus, type GlobalFileTag, type GlobalInstrument } from "@prisma/client";
import { createDemoLabels, createDemoString, type DemoContext } from "./context";

export async function seedDemoCatalogs(c: DemoContext) {
    const description = { "en-US": "Shared demo catalog", "fr-BE": "Catalogue de démonstration partagé", "nl-BE": "Gedeelde democatalogus" };
    const wind = await c.db.globalInstrumentFunctionalGroup.create({ data: {
        publicId: c.id("group:wind"), sortOrder: 0, color: "gold",
        ...await createDemoLabels(c, "group:wind", { "en-US": "Winds", "fr-BE": "Vents", "nl-BE": "Blazers" }, description),
    } });
    const rhythm = await c.db.globalInstrumentFunctionalGroup.create({ data: {
        publicId: c.id("group:rhythm"), sortOrder: 10, color: "blue",
        ...await createDemoLabels(c, "group:rhythm", { "en-US": "Rhythm", "fr-BE": "Rythme", "nl-BE": "Ritme" }, description),
    } });
    const instruments: GlobalInstrument[] = [];
    const definitions = [
        { key: "trumpet", group: wind, name: { "en-US": "Trumpet", "fr-BE": "Trompette", "nl-BE": "Trompet" } },
        // Dutch is intentionally absent here to exercise per-string fallback.
        { key: "drums", group: rhythm, name: { "en-US": "Drums", "fr-BE": "Batterie" } },
        { key: "bass", group: rhythm, name: { "en-US": "Bass", "fr-BE": "Basse", "nl-BE": "Bas" } },
    ];
    for (const [index, definition] of definitions.entries()) {
        instruments.push(await c.db.globalInstrument.create({ data: {
            publicId: c.id(`instrument:${definition.key}`), functionalGroupId: definition.group.id, sortOrder: index,
            autoAssignFileLeafRegex: definition.key,
            ...await createDemoLabels(c, `instrument:${definition.key}`, definition.name, description),
        } }));
    }
    const memberTag = await c.db.globalUserTag.create({ data: {
        publicId: c.id("user-tag:musician"), color: "green", sortOrder: 0,
        ...await createDemoLabels(c, "user-tag:musician", { "en-US": "Musicians", "fr-BE": "Musiciens", "nl-BE": "Muzikanten" }, description),
    } });
    const songTag = await c.db.globalSongTag.create({ data: {
        publicId: c.id("song-tag:repertoire"), color: "gold", sortOrder: 0,
        ...await createDemoLabels(c, "song-tag:repertoire", { "en-US": "Repertoire", "fr-BE": "Répertoire", "nl-BE": "Repertoire" }, description),
    } });
    const eventTag = await c.db.globalEventTag.create({ data: {
        publicId: c.id("event-tag:outdoor"), color: "green", visibleOnFrontpage: true,
        ...await createDemoLabels(c, "event-tag:outdoor", { "en-US": "Outdoor", "fr-BE": "En plein air", "nl-BE": "Buiten" }, description),
    } });
    const fileTags: GlobalFileTag[] = [];
    for (const [key, name] of [
        ["Partition", { "en-US": "Score", "fr-BE": "Partition", "nl-BE": "Partituur" }],
        ["Recording", { "en-US": "Recording", "fr-BE": "Enregistrement", "nl-BE": "Opname" }],
    ] as const) {
        fileTags.push(await c.db.globalFileTag.create({ data: { publicId: c.id(`file-tag:${key}`), significance: key,
            ...await createDemoLabels(c, `file-tag:${key}`, name, description) } }));
    }
    const concert = await c.db.eventType.create({ data: { publicId: c.id("event-type:concert"), significance: "Concert", color: "gold",
        ...await createDemoLabels(c, "event-type:concert", { "en-US": "Concert", "fr-BE": "Concert", "nl-BE": "Concert" }, description) } });
    const rehearsal = await c.db.eventType.create({ data: { publicId: c.id("event-type:rehearsal"), significance: "Rehearsal", color: "blue",
        ...await createDemoLabels(c, "event-type:rehearsal", { "en-US": "Rehearsal", "fr-BE": "Répétition", "nl-BE": "Repetitie" }, description) } });
    const statuses: EventStatus[] = [];
    for (const [index, definition] of [
        { key: "confirmed", significance: "FinalConfirmation", name: { "en-US": "Confirmed", "fr-BE": "Confirmé", "nl-BE": "Bevestigd" } },
        { key: "cancelled", significance: "Cancelled", name: { "en-US": "Cancelled", "fr-BE": "Annulé", "nl-BE": "Geannuleerd" } },
    ].entries()) {
        statuses.push(await c.db.eventStatus.create({ data: { publicId: c.id(`event-status:${definition.key}`), sortOrder: index,
            significance: definition.significance, ...await createDemoLabels(c, `event-status:${definition.key}`, definition.name, description) } }));
    }
    const attendance: EventAttendance[] = [];
    for (const [index, definition] of [
        { key: "yes", strength: 100, name: { "en-US": "Yes", "fr-BE": "Oui", "nl-BE": "Ja" },
            personal: { "en-US": "You are going", "fr-BE": "Vous venez", "nl-BE": "Je komt" },
            past: { "en-US": "Attended", "fr-BE": "Présent", "nl-BE": "Aanwezig" },
            personalPast: { "en-US": "You attended", "fr-BE": "Vous étiez présent", "nl-BE": "Je was aanwezig" } },
        { key: "maybe", strength: 50, name: { "en-US": "Maybe", "fr-BE": "Peut-être", "nl-BE": "Misschien" },
            personal: { "en-US": "You might come", "fr-BE": "Vous venez peut-être", "nl-BE": "Je komt misschien" },
            past: { "en-US": "Uncertain", "fr-BE": "Incertain", "nl-BE": "Onzeker" },
            personalPast: { "en-US": "You were uncertain", "fr-BE": "Vous étiez incertain", "nl-BE": "Je was onzeker" } },
        { key: "no", strength: 0, name: { "en-US": "No", "fr-BE": "Non", "nl-BE": "Nee" },
            personal: { "en-US": "You are not going", "fr-BE": "Vous ne venez pas", "nl-BE": "Je komt niet" },
            past: { "en-US": "Absent", "fr-BE": "Absent", "nl-BE": "Afwezig" },
            personalPast: { "en-US": "You were absent", "fr-BE": "Vous étiez absent", "nl-BE": "Je was afwezig" } },
    ].entries()) {
        const key = `attendance:${definition.key}`;
        attendance.push(await c.db.eventAttendance.create({ data: { publicId: c.id(key), sortOrder: index, strength: definition.strength,
            buttonCaptionId: await createDemoString(c, `${key}:button`, definition.name),
            personalCaptionId: await createDemoString(c, `${key}:personal`, definition.personal),
            pastCaptionId: await createDemoString(c, `${key}:past`, definition.past),
            personalPastCaptionId: await createDemoString(c, `${key}:personal-past`, definition.personalPast),
            descriptionId: await createDemoString(c, `${key}:description`, description, LocalizedStringFormat.Markdown) } }));
    }
    const creditType = await c.db.songCreditType.create({ data: { publicId: c.id("credit-type:arranger"),
        ...await createDemoLabels(c, "credit-type:arranger", { "en-US": "Arranger", "fr-BE": "Arrangeur", "nl-BE": "Arrangeur" }, description) } });
    return { groups: [wind, rhythm], instruments, memberTag, songTag, eventTag, fileTags, concert, rehearsal, statuses, attendance, creditType };
}

export type DemoCatalogs = Awaited<ReturnType<typeof seedDemoCatalogs>>;
