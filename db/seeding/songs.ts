import { faker } from "@faker-js/faker";
import type { Prisma, Song } from "@prisma/client";
import { generatePublicId } from "../../src/server/publicId";
import { randomVisibilityPermissionId, type SeedingState } from "./base";
import { seedFile } from "./files";
import { choose, probability, subset } from "./random";

export async function seedSongs(state: SeedingState, count: number): Promise<Song[]> {
    const songs: Song[] = [];
    const year = () => faker.number.int({ min: 2003, max: state.now.getUTCFullYear() });
    for (let index = 0; index < count; index++) {
        const song = await state.db.song.create({ data: {
            publicId: generatePublicId<"Song">(), bandId: state.band.band.id, name: faker.music.songName(),
            description: probability(0.5) ? faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 })) : "",
            aliases: probability(0.2) ? faker.music.songName() : "",
            startBPM: probability(0.7) ? faker.number.int({ min: 70, max: 160 }) : null,
            endBPM: probability(0.25) ? faker.number.int({ min: 70, max: 160 }) : null,
            introducedYear: probability(0.6) ? year() : null,
            lengthSeconds: probability(0.7) ? faker.number.int({ min: 30, max: 500 }) : null,
            visiblePermissionId: randomVisibilityPermissionId(state), createdByUserId: choose(state.band.members).userId,
        } });
        await state.db.bandSongTagAssociation.createMany({ data: subset(state.band.songTags, 0, 4).map(tag => ({
            publicId: generatePublicId<"BandSongTagAssociation">(), songId: song.id, bandSongTagId: tag.id,
        })) });
        const credits: Prisma.SongCreditCreateManyInput[] = [];
        const creditCount = faker.number.int({ min: 0, max: 3 });
        for (let credit = 0; credit < creditCount; credit++) {
            credits.push({ publicId: generatePublicId<"SongCredit">(), songId: song.id, userId: choose(state.band.members).userId,
                typeId: choose(state.platform.creditTypes).id, comment: probability(0.2) ? faker.lorem.sentence() : "", year: probability(0.5) ? String(year()) : "" });
        }
        await state.db.songCredit.createMany({ data: credits });
        const fileCount = probability(0.5) ? 0 : faker.number.int({ min: 0, max: 12 });
        for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
            const file = await seedFile(state, randomVisibilityPermissionId(state), { assetIndex: null, isDeleted: probability(0.8), name: faker.lorem.words({ min: 1, max: 6 }) });
            await state.db.fileSongTag.create({ data: { publicId: generatePublicId<"FileSongTag">(), fileId: file.id, songId: song.id } });
        }
        songs.push(song);
    }
    return songs;
}
