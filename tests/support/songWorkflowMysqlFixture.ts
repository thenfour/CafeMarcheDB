import type { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType } from "shared/quickFilter";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";
import { DiscreteCriterionFilterType as Behavior, type GetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { prepareEventAttendanceFixture } from "./eventAttendanceMysqlFixture";
import type { SettingsMysqlFixture } from "./settingsMysqlFixture";

export function songTransactionRoot(tx: Prisma.TransactionClient): DB3ReadRootDatabase {
    // The native fixture owns the outer transaction; each attempted write can still roll back atomically.
    return { $transaction: async work => {
        await tx.$executeRawUnsafe("SAVEPOINT song_command");
        try {
            return await work(tx);
        } catch (error) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT song_command");
            throw error;
        } finally {
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT song_command");
        }
    } };
}

export async function prepareSongs(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [Permission.manage_events, Permission.view_events_nonpublic,
        Permission.manage_songs, Permission.view_songs, Permission.view_files, Permission.pin_song_recordings, Permission.visibility_members]);
    const bandPublicId = c.args.bandPublicId;
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const text = (english: string, french: string) => tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: english },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: french },
        ] },
    } });
    const sharedName = await text("Concert", "Concert francais");
    const description = await text("Tag description", "Description francaise");
    const globalTag = await tx.globalSongTag.create({ data: { publicId: generatePublicId(), nameId: sharedName.id,
        descriptionId: description.id, color: "green", sortOrder: 7 } });
    const firstTag = await tx.bandSongTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, globalSongTagId: globalTag.id } });
    const secondName = await text("March", "Marche");
    const secondTag = await tx.bandSongTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, nameId: secondName.id, sortOrder: 2 } });
    const hiddenTag = await tx.bandSongTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, nameId: secondName.id, isHidden: true } });
    const foreignTag = await tx.bandSongTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, globalSongTagId: globalTag.id } });
    const file = await tx.file.create({ data: { publicId: generatePublicId(), bandId: c.band.id, fileLeafName: "song.wav",
        storedLeafName: generatePublicId(), uploadedAt: new Date(), uploadedByUserId: fixture.user.id, description: "", mimeType: "audio/wav", visiblePermissionId: visibility.id } });
    const songs = await Promise.all(["Alpha", "Bravo", "Charlie", "Delta"].map((name, index) => tx.song.create({ data: {
        publicId: generatePublicId(), bandId: c.band.id, name, description: index === 2 ? "A harbour waltz" : "Song description",
        aliases: index === 0 ? "harbour waltz" : "", startBPM: 90 + index, introducedYear: 2026,
        createdByUserId: fixture.user.id, visiblePermissionId: visibility.id, pinnedRecordingId: index === 0 ? file.id : null,
        taggedFiles: index === 0 ? { create: { publicId: generatePublicId(), fileId: file.id } } : undefined,
        tags: { create: (index === 0 ? [firstTag] : index === 1 ? [secondTag] : index === 2 ? [firstTag, secondTag] : [hiddenTag]).map(tag => ({ publicId: generatePublicId(), bandSongTagId: tag.id })) },
    } })));
    const foreign = await tx.song.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Foreign song",
        description: "", aliases: "", visiblePermissionId: visibility.id, createdByUserId: fixture.user.id } });
    await tx.song.createMany({ data: [
        { publicId: generatePublicId(), bandId: c.band.id, name: "Private secret", aliases: "", description: "", createdByUserId: fixture.admin.id },
        { publicId: generatePublicId(), bandId: c.band.id, name: "Deleted secret", aliases: "", description: "", createdByUserId: fixture.user.id, visiblePermissionId: visibility.id, isDeleted: true },
    ] });
    const snapshot = () => bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
    const target = { bandPublicId, songId: parsePublicId<"Song">(songs[0]!.publicId) };
    const query = (patch: Partial<GetSearchResultsInput> = {}): GetSearchResultsInput => ({
        bandPublicId, tableID: "Song", viewID: "Song_Search", offset: 0, take: 20, quickFilter: "",
        sort: [{ db3Column: "name", direction: "asc" }], discreteCriteria: [{ db3Column: "tags", behavior: Behavior.alwaysMatch, options: [] }], ...patch,
    });
    const search = async (patch: Partial<GetSearchResultsInput> = {}) => GetSearchResultsCore(query(patch), c.auth, await snapshot());
    const quick = async (keyword: string) => getQuickSearchResults({ bandPublicId, keyword, allowedItemTypes: [QuickSearchItemType.song], permissionPolicy: "requireAll", routeLocale: "fr-BE" }, c.auth, await snapshot());
    return { ...c, target, visibility, songs, foreign, file, firstTag, secondTag, hiddenTag, foreignTag, text, globalTag,
        snapshot, query, search, quick, root: songTransactionRoot(tx) };
}
