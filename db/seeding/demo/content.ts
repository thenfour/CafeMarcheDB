import type { Event, File, Song, WikiPage } from "@prisma/client";
import { demoChoice } from "./config";
import { createDemoString, type DemoContext } from "./context";
import type { DemoBand } from "./bands";
import type { DemoCatalogs } from "./catalogs";
import type { DemoAssets } from "./assets";

export async function seedDemoSongs(c: DemoContext, b: DemoContentBand, catalogs: DemoCatalogs, assets: DemoAssets) {
    const songs: Song[] = [];
    for (let index = 0; index < c.config.songsPerBand; index++) {
        const key = `${b.key}:song:${index}`;
        const song = await c.db.song.create({ data: {
            publicId: c.id(key), bandId: b.band.id, name: `${b.title} — ${["River Walk", "Harbour Lights", "Marché du matin"][index % 3]} ${index + 1}`,
            description: "Original demo repertoire. Répertoire de démonstration. Demonstratierepertoire.",
            startBPM: 90 + demoChoice(c.config, key, 70), lengthSeconds: 180 + index * 15,
            visiblePermissionId: b.memberVisibilityId, createdByUserId: b.manager.id,
        } });
        await c.db.bandSongTagAssociation.create({ data: { publicId: c.id(`${key}:tag`), songId: song.id, bandSongTagId: b.songTag.id } });
        await c.db.songCredit.create({ data: { publicId: c.id(`${key}:credit`), songId: song.id,
            userId: b.manager.id, typeId: catalogs.creditType.id, comment: "Demo arrangement", year: c.config.referenceDate.slice(0, 4) } });
        songs.push(song);
    }
    const files: File[] = [];
    for (const [index, definition] of [
        { storedLeafName: "cmdb-demo-score.svg", mimeType: "image/svg+xml", sizeBytes: assets.scoreBytes },
        { storedLeafName: "cmdb-demo-recording.wav", mimeType: "audio/wav", sizeBytes: assets.recordingBytes },
    ].entries()) {
        const key = `${b.key}:file:${index}`;
        const file = await c.db.file.create({ data: { ...definition, publicId: c.id(key),
            // Each row has its own storage identity; the runner writes identical sample bytes for each band.
            storedLeafName: `${c.id(key)}.${index === 0 ? "svg" : "wav"}`,
            bandId: b.band.id, fileLeafName: `${b.title}-${index === 0 ? "score.svg" : "recording.wav"}`,
            description: `Sample asset for ${b.title}`, uploadedAt: new Date(`${c.config.referenceDate}T12:00:00Z`),
            uploadedByUserId: b.manager.id, visiblePermissionId: b.memberVisibilityId,
        } });
        await c.db.bandFileTagAssignment.create({ data: { publicId: c.id(`${key}:tag`), fileId: file.id, bandFileTagId: b.fileTags[index]!.id } });
        await c.db.fileInstrumentTag.create({ data: { publicId: c.id(`${key}:instrument`), fileId: file.id, bandInstrumentId: b.instruments[0]!.id } });
        await c.db.fileUserTag.create({ data: { publicId: c.id(`${key}:member`), fileId: file.id, bandUserId: b.members[0]!.id } });
        if (songs[0]) {
            await c.db.fileSongTag.create({ data: { publicId: c.id(`${key}:song`), fileId: file.id, songId: songs[0].id } });
            if (index === 1) {
                await c.db.song.update({ where: { id: songs[0].id }, data: { pinnedRecordingId: file.id } });
            }
        }
        await c.db.customLink.create({ data: { publicId: c.id(`${key}:link`), bandId: b.band.id,
            name: index === 0 ? "Demo score" : "Demo recording", description: "Local sample asset", slug: index === 0 ? "score" : "recording",
            redirectType: "ServeFile", fileId: file.id, createdByUserId: b.manager.id } });
        files.push(file);
    }
    return { songs, files };
}

// All ordinary demo content is member-visible. This is resolved once by the seed orchestrator.
export interface DemoContentBand extends DemoBand { memberVisibilityId: number }

export async function seedDemoWiki(c: DemoContext, b: DemoContentBand) {
    const tag = await c.db.bandWikiPageTag.create({ data: { publicId: c.id(`${b.key}:wiki-tag`), bandId: b.band.id,
        nameId: await createDemoString(c, `${b.key}:wiki-tag:name`, { "en-US": "Band information", "fr-BE": "Informations du groupe", "nl-BE": "Bandinformatie" }) } });
    const pages: WikiPage[] = [];
    for (const tag of b.locales) {
        const language = tag === "fr-BE" ? { slug: "bienvenue", title: "Bienvenue", text: "Bienvenue dans notre groupe. La répétition a lieu chaque semaine." }
            : tag === "nl-BE" ? { slug: "welkom", title: "Welkom", text: "Welkom bij onze band. We repeteren elke week." }
                : { slug: "welcome", title: "Welcome", text: "Welcome to our band. We rehearse every week." };
        const key = `${b.key}:wiki:${tag}`;
        const page = await c.db.wikiPage.create({ data: { publicId: c.id(key), bandId: b.band.id, slug: language.slug,
            createdByUserId: b.manager.id, visiblePermissionId: b.memberVisibilityId, contentVersion: 1 } });
        const revision = await c.db.wikiPageRevision.create({ data: { publicId: c.id(`${key}:revision`), wikiPageId: page.id,
            createdByUserId: b.manager.id, name: `${language.title} — ${b.title}`, content: `# ${b.title}\n\n${language.text}\n\n[Demo score](/score?bandPublicId=${b.band.publicId})` } });
        await c.db.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: revision.id } });
        pages.push(page);
    }
    for (const page of pages) {
        await c.db.wikiPageTagAssignment.create({ data: { publicId: c.id(`${b.key}:wiki-tag:${page.slug}`), wikiPageId: page.id, bandWikiPageTagId: tag.id } });
    }
    await c.db.menuLink.create({ data: { publicId: c.id(`${b.key}:menu:welcome`), bandId: b.band.id,
        captionId: await createDemoString(c, `${b.key}:menu:welcome:caption`, { "en-US": "Welcome", "fr-BE": "Bienvenue", "nl-BE": "Welkom" }),
        realm: "General", applicationPage: "BackstageHome", groupName: "Demo", groupCssClass: "", itemCssClass: "",
        linkType: "Wiki", wikiSlug: "welcome", visiblePermissionId: b.memberVisibilityId, createdByUserId: b.manager.id } });
    return pages;
}

export async function seedDemoEvents(c: DemoContext, b: DemoContentBand, catalogs: DemoCatalogs,
    songs: ReadonlyArray<Pick<Song, "id">>) {
    const events: Event[] = [];
    for (let index = 0; index < c.config.eventsPerBand; index++) {
        const key = `${b.key}:event:${index}`;
        const publicId = c.id(key);
        const description = await c.db.wikiPage.create({ data: {
            publicId: c.id(`${key}:description`), bandId: b.band.id, slug: `EventDescription/${publicId}`,
            namespace: "EventDescription", visiblePermissionId: b.memberVisibilityId, createdByUserId: b.manager.id, contentVersion: 1,
        } });
        const revision = await c.db.wikiPageRevision.create({ data: {
            publicId: c.id(`${key}:description:revision`), wikiPageId: description.id, createdByUserId: b.manager.id,
            name: "Event description", content: `# ${b.title}\n\nBring your instrument. Apportez votre instrument. Breng je instrument mee.`,
        } });
        await c.db.wikiPage.update({ where: { id: description.id }, data: { currentRevisionId: revision.id } });
        const startsAt = new Date(`${c.config.referenceDate}T17:00:00Z`);
        startsAt.setUTCDate(startsAt.getUTCDate() + (index === 0 ? -7 : index * 7));
        const durationMillis = BigInt(2 * 60 * 60 * 1_000);
        const event = await c.db.event.create({ data: { publicId, bandId: b.band.id, revision: 1,
            uid: `${c.id(key)}@demo.invalid`, name: `${b.title} — ${index % 2 === 0 ? "Concert" : "Répétition / Repetitie"} ${index + 1}`,
            typeId: index % 2 === 0 ? catalogs.concert.id : catalogs.rehearsal.id,
            statusId: catalogs.statuses[index === 3 ? 1 : 0]!.id, startsAt, durationMillis, isAllDay: false,
            endDateTime: new Date(startsAt.getTime() + Number(durationMillis)), locationDescription: `${b.title} rehearsal room`,
            visiblePermissionId: b.memberVisibilityId, createdByUserId: b.manager.id, expectedAttendanceUserTagId: b.memberTag.id,
            descriptionWikiPageId: description.id } });
        const segment = await c.db.eventSegment.create({ data: { publicId: c.id(`${key}:segment`), eventId: event.id,
            uid: `${c.id(`${key}:segment`)}@demo.invalid`, name: "Set 1", description: "Demo segment", startsAt, durationMillis, isAllDay: false } });
        await c.db.eventTagAssignment.create({ data: { publicId: c.id(`${key}:tag`), eventId: event.id, bandEventTagId: b.eventTag.id } });
        const list = await c.db.eventSongList.create({ data: { publicId: c.id(`${key}:setlist`), eventId: event.id,
            name: "Set 1", description: "Demo setlist", isActuallyPlayed: index === 0 } });
        await c.db.eventSongListSong.createMany({ data: songs.slice(0, 4).map((song, sortOrder) => ({
            publicId: c.id(`${key}:setlist:song:${sortOrder}`), eventSongListId: list.id, songId: song.id, sortOrder,
        })) });
        for (const [memberIndex, member] of b.members.entries()) {
            await c.db.eventUserResponse.create({ data: { publicId: c.id(`${key}:response:${memberIndex}`),
                eventId: event.id, bandUserId: member.id, isInvited: memberIndex !== b.members.length - 1,
                bandInstrumentId: member.instrumentId, userComment: memberIndex === 0 ? "Shared person, band-specific response" : null } });
            await c.db.eventSegmentUserResponse.create({ data: { publicId: c.id(`${key}:attendance:${memberIndex}`),
                eventSegmentId: segment.id, bandUserId: member.id, createdByUserId: member.userId,
                attendanceId: memberIndex === 2 ? null : catalogs.attendance[demoChoice(c.config, `${key}:${memberIndex}`, catalogs.attendance.length)]!.id } });
        }
        await c.db.action.create({ data: { userId: b.members[0]!.userId, bandId: b.band.id,
            localeContextId: c.locales.get(b.locales[index % b.locales.length]!), eventId: event.id,
            isClient: true, feature: "event_view", uri: `/backstage/event/${event.publicId}`, createdAt: startsAt,
            language: "en", locale: "en-us", deviceClass: "desktop", context: "demo seed" } });
        events.push(event);
    }
    return events;
}
