import { testBandAuthorization, testServerAuthorization } from "tests/support/serverAuthorization";
import { describe, expect, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { projectDB3ModelPublicIds, resolvePublicForeignIds, resolvePublicIds, resolvePublicQueryParameters } from "@db3/server/db3PublicIds";
import { validateDB3MutationRequest, validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { userPublicId } from "../support/userFixtures";

const publicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");
const songTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn04");
const otherSongTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn05");
const songTagAssociationPublicId = parsePublicId<"SongTagAssociation">("AbCdEfGhIjKlMn06");
const instrumentPublicId = parsePublicId<"Instrument">("AbCdEfGhIjKlMn07");
const fileTagPublicId = parsePublicId<"FileTag">("AbCdEfGhIjKlMn08");
const fileTagAssociationPublicId = parsePublicId<"FileTagAssignment">("AbCdEfGhIjKlMn09");
const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("AbCdEfGhIjKlMn10");
const wikiPageTagAssignmentPublicId = parsePublicId<"WikiPageTagAssignment">("AbCdEfGhIjKlMn11");
const userTagPublicId = parsePublicId<"UserTag">("AbCdEfGhIjKlMn12");
const userTagAssignmentPublicId = parsePublicId<"BandUserTagAssignment">("AbCdEfGhIjKlMn13");
const songCreditTypePublicId = parsePublicId<"SongCreditType">("AbCdEfGhIjKlMn14");
const songCreditPublicId = parsePublicId<"SongCredit">("AbCdEfGhIjKlMn15");
const userInstrumentPublicId = parsePublicId<"BandUserInstrument">("AbCdEfGhIjKlMn16");
const fileUserTagPublicId = parsePublicId<"FileUserTag">("AbCdEfGhIjKlMn17");
const fileSongTagPublicId = parsePublicId<"FileSongTag">("AbCdEfGhIjKlMn18");
const songPublicId = parsePublicId<"Song">("AbCdEfGhIjKlMn31");
const filePublicId = parsePublicId<"File">("AbCdEfGhIjKlMn32");
const fileEventTagPublicId = parsePublicId<"FileEventTag">("AbCdEfGhIjKlMn19");
const fileInstrumentTagPublicId = parsePublicId<"FileInstrumentTag">("AbCdEfGhIjKlMn20");
const fileWikiPageTagPublicId = parsePublicId<"FileWikiPageTag">("AbCdEfGhIjKlMn21");
const wikiPagePublicId = parsePublicId<"WikiPage">("AbCdEfGhIjKlMn23");
const eventPublicId = parsePublicId<"Event">("AbCdEfGhIjKlMn22");
const instrumentId = 7;
const group = {
    id: 54,
    publicId,
    name: "Brass",
    description: "Brass instruments",
    color: "orange",
    sortOrder: 1,
};
const authorization = (...permissions: Permission[]): CMServerAuthorization => testServerAuthorization(
    { id: 100 },
    new ServerPermissionSet([
        { id: 1, name: Permission.always_grant },
        ...permissions.map((name, index) => ({ id: index + 2, name })),
    ]),
);

const sanitizeGroup = (publicData: CMServerAuthorization) => {
    const scoped = testBandAuthorization({ id: publicData.userId! }, publicData.effectivePermissions);
    const result = db3.xInstrumentFunctionalGroup.authorizeAndSanitize({
        contextDesc: "public-id-transport-test",
        model: { ...group, bandId: 1 },
        rowMode: "view",
        fallbackOwnerId: null,
        auth: scoped,
    });
    expect(result.rowIsAuthorized).toBe(true);
    return projectDB3ModelPublicIds(db3.xInstrumentFunctionalGroup, result.authorizedModel, publicData);
};

describe("instrument catalog public-ID transport", () => {
    it("uses publicId as canonical client identity for every role", () => {
        const expected = {
            publicId,
            name: group.name,
            description: group.description,
            color: group.color,
            sortOrder: group.sortOrder,
        };
        expect(sanitizeGroup(authorization(Permission.login))).toEqual(expected);
        expect(sanitizeGroup(authorization(Permission.login, Permission.sysadmin))).toEqual(expected);
    });

    it("projects converted foreign keys through direct, association, and nested relation payloads", () => {
        const instrument = {
            id: instrumentId,
            publicId: instrumentPublicId,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: group.id,
            functionalGroup: group,
        };
        const publicData = authorization(Permission.login);

        const projectedInstrument = projectDB3ModelPublicIds(db3.xInstrument, instrument, publicData);
        expect(projectedInstrument.publicId).toBe(instrumentPublicId);
        expect(projectedInstrument).not.toHaveProperty("id");
        expect(projectedInstrument.functionalGroupId).toBe(publicId);
        expect(projectedInstrument.functionalGroup).toMatchObject({ publicId, name: "Brass" });
        expect(projectedInstrument.functionalGroup).not.toHaveProperty("id");

        const projectedFile = projectDB3ModelPublicIds(db3.xFile, {
            id: 90,
            publicId: filePublicId,
            tags: [{
                id: 92,
                publicId: fileTagAssociationPublicId,
                fileId: 90,
                bandFileTagId: 21,
                bandFileTag: {
                    id: 21,
                    publicId: fileTagPublicId,
                    name: "Partition",
                },
            }],
            taggedUsers: [{
                id: 93,
                publicId: fileUserTagPublicId,
                fileId: 90,
                userId: 100,
                user: { id: 100, publicId: userPublicId(100), name: "Ada" },
            }],
            taggedSongs: [{
                id: 94,
                publicId: fileSongTagPublicId,
                fileId: 90,
                songId: 101,
                song: { id: 101, publicId: songPublicId, name: "A song" },
            }],
            taggedEvents: [{
                id: 95,
                publicId: fileEventTagPublicId,
                fileId: 90,
                eventId: 102,
                event: { id: 102, publicId: eventPublicId, name: "A concert" },
            }],
            taggedInstruments: [{
                id: 91,
                publicId: fileInstrumentTagPublicId,
                fileId: 90,
                instrumentId: instrument.id,
                instrument,
            }],
            taggedWikiPages: [{
                id: 96,
                publicId: fileWikiPageTagPublicId,
                fileId: 90,
                wikiPageId: 103,
                wikiPage: { id: 103, publicId: wikiPagePublicId, slug: "repertoire" },
            }],
        }, publicData);
        expect(projectedFile.publicId).toBe(filePublicId);
        expect(projectedFile).not.toHaveProperty("id");
        expect(projectedFile.tags[0]).not.toHaveProperty("fileId");
        expect(projectedFile.taggedSongs[0]).not.toHaveProperty("fileId");
        const nestedInstrument = projectedFile.taggedInstruments[0].instrument;
        expect(projectedFile.taggedInstruments[0].instrumentId).toBe(instrumentPublicId);
        expect(projectedFile.taggedInstruments[0].publicId).toBe(fileInstrumentTagPublicId);
        expect(projectedFile.taggedInstruments[0]).not.toHaveProperty("id");
        expect(nestedInstrument.publicId).toBe(instrumentPublicId);
        expect(nestedInstrument).not.toHaveProperty("id");
        expect(nestedInstrument.functionalGroupId).toBe(publicId);
        expect(nestedInstrument.functionalGroup).not.toHaveProperty("id");
        expect(projectedFile.tags[0]).toMatchObject({
            publicId: fileTagAssociationPublicId,
            bandFileTagId: fileTagPublicId,
            bandFileTag: { publicId: fileTagPublicId, name: "Partition" },
        });
        expect(projectedFile.tags[0]).not.toHaveProperty("id");
        expect(projectedFile.tags[0].bandFileTag).not.toHaveProperty("id");
        expect(projectedFile.taggedUsers[0]).toMatchObject({
            publicId: fileUserTagPublicId,
            userId: userPublicId(100),
            user: { publicId: userPublicId(100), name: "Ada" },
        });
        expect(projectedFile.taggedSongs[0]).toMatchObject({
            publicId: fileSongTagPublicId,
            songId: songPublicId,
            song: { publicId: songPublicId, name: "A song" },
        });
        expect(projectedFile.taggedEvents[0]).toMatchObject({
            publicId: fileEventTagPublicId,
            eventId: eventPublicId,
            event: { publicId: eventPublicId, name: "A concert" },
        });
        expect(projectedFile.taggedEvents[0].event).not.toHaveProperty("id");
        expect(projectedFile.taggedWikiPages[0]).toMatchObject({
            publicId: fileWikiPageTagPublicId,
            wikiPageId: wikiPagePublicId,
            wikiPage: { publicId: wikiPagePublicId, slug: "repertoire" },
        });
        expect(projectedFile.taggedUsers[0]).not.toHaveProperty("id");
        expect(projectedFile.taggedSongs[0]).not.toHaveProperty("id");
        expect(projectedFile.taggedEvents[0]).not.toHaveProperty("id");
        expect(projectedFile.taggedWikiPages[0]).not.toHaveProperty("id");

        const projectedSong = projectDB3ModelPublicIds(db3.xSong, {
            id: 92,
            publicId: songPublicId,
            tags: [{
                id: 93,
                publicId: songTagAssociationPublicId,
                songId: 92,
                song: { id: 92, publicId: songPublicId },
                tagId: 94,
                tag: {
                    id: 94,
                    publicId: songTagPublicId,
                    text: "March",
                },
            }],
            credits: [{
                id: 95,
                publicId: songCreditPublicId,
                songId: 92,
                song: { id: 92, publicId: songPublicId },
                userId: 100,
                user: { id: 100, publicId: userPublicId(100), name: "Ada", isDeleted: false },
                typeId: 96,
                type: {
                    id: 96,
                    publicId: songCreditTypePublicId,
                    text: "Composer",
                },
            }],
        }, authorization(Permission.view_songs, Permission.view_users_basic_info));
        expect(projectedSong.tags[0]).toMatchObject({
            publicId: songTagAssociationPublicId,
            songId: songPublicId,
            tagId: songTagPublicId,
            tag: { publicId: songTagPublicId, text: "March" },
        });
        expect(projectedSong.tags[0]).not.toHaveProperty("id");
        expect(projectedSong.tags[0].tag).not.toHaveProperty("id");
        expect(projectedSong.credits[0]).toMatchObject({
            publicId: songCreditPublicId,
            songId: songPublicId,
            userId: userPublicId(100),
            typeId: songCreditTypePublicId,
            type: { publicId: songCreditTypePublicId, text: "Composer" },
        });
        expect(projectedSong.credits[0]).not.toHaveProperty("id");
        expect(projectedSong.credits[0].type).not.toHaveProperty("id");

        const projectedWikiPage = projectDB3ModelPublicIds(db3.xWikiPage, {
            id: 96,
            publicId: wikiPagePublicId,
            tags: [{
                id: 97,
                publicId: wikiPageTagAssignmentPublicId,
                wikiPageId: 96,
                tagId: 98,
                tag: {
                    id: 98,
                    publicId: wikiPageTagPublicId,
                    text: "Policy",
                },
            }],
        }, authorization(Permission.view_wiki_pages));
        expect(projectedWikiPage.tags[0]).toMatchObject({
            publicId: wikiPageTagAssignmentPublicId,
            tagId: wikiPageTagPublicId,
            tag: { publicId: wikiPageTagPublicId, text: "Policy" },
        });
        expect(projectedWikiPage.tags[0]).not.toHaveProperty("id");
        expect(projectedWikiPage.tags[0].tag).not.toHaveProperty("id");

        const memberPublicId = parsePublicId<"BandUser">("MemberTransport1");
        const member = { id: 500, publicId: memberPublicId };
        const projectedMember = projectDB3ModelPublicIds(db3.xBandUser, {
            ...member,
            bandUserInstruments: [{
                id: 102, publicId: userInstrumentPublicId,
                bandUserId: member.id, bandUser: member,
                bandInstrumentId: instrument.id, bandInstrument: instrument, isPrimary: true,
            }],
            bandUserTagAssignments: [{
                id: 100, publicId: userTagAssignmentPublicId,
                bandUserId: member.id, bandUser: member,
                bandUserTagId: 101, bandUserTag: { id: 101, publicId: userTagPublicId },
            }],
        }, authorization(Permission.view_users_basic_info));
        expect(projectedMember.bandUserTagAssignments[0]).toMatchObject({
            publicId: userTagAssignmentPublicId,
            bandUserId: memberPublicId,
            bandUserTagId: userTagPublicId,
            bandUserTag: { publicId: userTagPublicId },
        });
        expect(projectedMember.bandUserTagAssignments[0]).not.toHaveProperty("id");
        expect(projectedMember.bandUserTagAssignments[0].bandUserTag).not.toHaveProperty("id");
        expect(projectedMember.bandUserInstruments[0]).toMatchObject({
            publicId: userInstrumentPublicId,
            bandUserId: memberPublicId,
            bandInstrumentId: instrumentPublicId,
            bandInstrument: { publicId: instrumentPublicId, name: "Trumpet" },
            isPrimary: true,
        });
        expect(projectedMember.bandUserInstruments[0]).not.toHaveProperty("id");
        expect(projectedMember.bandUserInstruments[0].bandInstrument).not.toHaveProperty("id");
    });
    it("accepts only public targets for converted-table queries and mutations", () => {
        expect(() => validateDB3QueryRequest({
            table: { tableID: db3.xBandInstrumentFunctionalGroup.tableID, tableName: db3.xBandInstrumentFunctionalGroup.tableName },
            filter: { items: [], publicIds: [publicId] },
            cmdbQueryContext: "public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: db3.xBandInstrument.tableID, tableName: db3.xBandInstrument.tableName },
            filter: { items: [], publicIds: [instrumentPublicId] },
            cmdbQueryContext: "public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: "Song", tableName: "Song" },
            filter: { items: [], tableParams: { songTagIds: [songTagPublicId] } },
            cmdbQueryContext: "song-tag-public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: "Song", tableName: "Song" },
            filter: { items: [], tableParams: { songTagIds: [94] } },
            cmdbQueryContext: "song-tag-natural-id-test",
        })).toThrow("Expected string, received number");
        expect(() => validateDB3QueryRequest({
            table: { tableID: "File", tableName: "File" },
            filter: { items: [], tableParams: { fileTagIds: [fileTagPublicId] } },
            cmdbQueryContext: "file-tag-public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: "File", tableName: "File" },
            filter: { items: [], tableParams: { fileId: filePublicId } },
            cmdbQueryContext: "file-public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: "File", tableName: "File" },
            filter: { items: [], tableParams: { fileId: 90 } },
            cmdbQueryContext: "file-natural-id-test",
        })).toThrow("Expected string, received number");
        expect(() => validateDB3QueryRequest({
            table: { tableID: "File", tableName: "File" },
            filter: { items: [], tableParams: { fileTagIds: [21] } },
            cmdbQueryContext: "file-tag-natural-id-test",
        })).toThrow("Expected string, received number");
        expect(() => validateDB3QueryRequest({
            table: { tableID: "BandUserTag", tableName: "bandUserTag" },
            filter: { items: [], tableParams: { ids: [userTagPublicId] } },
            cmdbQueryContext: "user-tag-public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: "BandUserTag", tableName: "bandUserTag" },
            filter: { items: [], tableParams: { ids: [101] } },
            cmdbQueryContext: "user-tag-natural-id-test",
        })).toThrow("Expected string, received number");

        expect(() => validateDB3MutationRequest({
            tableID: db3.xBandInstrumentFunctionalGroup.tableID,
            tableName: db3.xBandInstrumentFunctionalGroup.tableName,
            mutationType: "update",
            updatePublicId: publicId,
            updateModel: { name: { kind: "set", localeTag: "en-US", stringPublicId: null, value: "Winds" } },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: db3.xBandInstrumentFunctionalGroup.tableID,
            tableName: db3.xBandInstrumentFunctionalGroup.tableName,
            mutationType: "update",
            updateId: group.id,
            updateModel: { name: { kind: "set", localeTag: "en-US", stringPublicId: null, value: "Winds" } },
        })).toThrow("updates require updatePublicId");
        expect(() => validateDB3MutationRequest({
            tableID: db3.xBandInstrumentFunctionalGroup.tableID,
            tableName: db3.xBandInstrumentFunctionalGroup.tableName,
            mutationType: "insert",
            insertModel: { name: { kind: "set", localeTag: "en-US", stringPublicId: null, value: "Winds" }, publicId },
        })).toThrow("field 'publicId' is server-generated");

        expect(() => validateDB3MutationRequest({
            tableID: db3.xBandInstrument.tableID,
            tableName: db3.xBandInstrument.tableName,
            mutationType: "update",
            updatePublicId: instrumentPublicId,
            updateModel: { functionalGroupId: publicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: db3.xBandInstrument.tableID,
            tableName: db3.xBandInstrument.tableName,
            mutationType: "update",
            updateId: instrumentId,
            updateModel: { functionalGroupId: publicId },
        })).toThrow("updates require updatePublicId");

        expect(() => validateDB3MutationRequest({
            tableID: db3.xBandSongTag.tableID,
            tableName: db3.xBandSongTag.tableName,
            mutationType: "update",
            updatePublicId: songTagPublicId,
            updateModel: { name: { kind: "set", localeTag: "en-US", stringPublicId: null, value: "Processional" } },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "SongTagAssociation",
            tableName: "SongTagAssociation",
            mutationType: "update",
            updatePublicId: songTagAssociationPublicId,
            updateModel: { tagId: songTagPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "BandFileTag",
            tableName: "bandFileTag",
            mutationType: "update",
            updatePublicId: fileTagPublicId,
            updateModel: { name: { kind: "set", localeTag: "en-US", stringPublicId: null, value: "Chart" } },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "BandFileTagAssignment",
            tableName: "bandFileTagAssignment",
            mutationType: "update",
            updatePublicId: fileTagAssociationPublicId,
            updateModel: { bandFileTagId: fileTagPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "WikiPageTag",
            tableName: "WikiPageTag",
            mutationType: "update",
            updatePublicId: wikiPageTagPublicId,
            updateModel: { text: "Procedure" },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "WikiPageTagAssignment",
            tableName: "WikiPageTagAssignment",
            mutationType: "update",
            updatePublicId: wikiPageTagAssignmentPublicId,
            updateModel: { tagId: wikiPageTagPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "BandUserTag",
            tableName: "bandUserTag",
            mutationType: "update",
            updatePublicId: userTagPublicId,
            updateModel: { name: { kind: "set", localeTag: "en-US", stringPublicId: null, value: "Current members" } },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "BandUserTagAssignment",
            tableName: "bandUserTagAssignment",
            mutationType: "update",
            updatePublicId: userTagAssignmentPublicId,
            updateModel: { bandUserTagId: userTagPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "SongCreditType",
            tableName: "SongCreditType",
            mutationType: "update",
            updatePublicId: songCreditTypePublicId,
            updateModel: { text: "Composer" },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "SongCredit",
            tableName: "SongCredit",
            mutationType: "update",
            updatePublicId: songCreditPublicId,
            updateModel: { typeId: songCreditTypePublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "SongCredit",
            tableName: "SongCredit",
            mutationType: "update",
            updateId: 95,
            updateModel: { typeId: songCreditTypePublicId },
        })).toThrow("updates require updatePublicId");
        expect(() => validateDB3MutationRequest({
            tableID: "FileUserTag",
            tableName: "FileUserTag",
            mutationType: "update",
            updatePublicId: fileUserTagPublicId,
            updateModel: { userId: 100 },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileSongTag",
            tableName: "FileSongTag",
            mutationType: "update",
            updatePublicId: fileSongTagPublicId,
            updateModel: { songId: songPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileEventTag",
            tableName: "FileEventTag",
            mutationType: "update",
            updatePublicId: fileEventTagPublicId,
            updateModel: { eventId: eventPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileInstrumentTag",
            tableName: "FileInstrumentTag",
            mutationType: "update",
            updatePublicId: fileInstrumentTagPublicId,
            updateModel: { instrumentId: instrumentPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileWikiPageTag",
            tableName: "FileWikiPageTag",
            mutationType: "update",
            updatePublicId: fileWikiPageTagPublicId,
            updateModel: { wikiPageId: 103 },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileSongTag",
            tableName: "FileSongTag",
            mutationType: "update",
            updateId: 94,
            updateModel: { songId: songPublicId },
        })).toThrow("updates require updatePublicId");
    });

    it("resolves an Event invitation tag public ID before persistence", async () => {
        const findMany = vi.fn(async () => [{ id: 101, publicId: userTagPublicId }]);
        const resolved = await resolvePublicForeignIds(
            db3.xEvent,
            { expectedAttendanceUserTagId: userTagPublicId },
            testBandAuthorization({ id: 100 }, authorization(Permission.login).effectivePermissions),
            { bandUserTag: { findMany } } as unknown as Parameters<typeof resolvePublicForeignIds>[3], // This fixture implements only the tag lookup.
        );

        expect(resolved.expectedAttendanceUserTagId).toBe(101);
        expect(findMany).toHaveBeenCalledOnce();
    });

    it("resolves a SongCredit type public ID before persistence", async () => {
        const findMany = vi.fn(async () => [{ id: 96, publicId: songCreditTypePublicId }]);
        const resolved = await resolvePublicForeignIds(
            db3.xSongCredit,
            { typeId: songCreditTypePublicId },
            authorization(Permission.view_songs),
            { SongCreditType: { findMany } } as any,
        );

        expect(resolved.typeId).toBe(96);
        expect(findMany).toHaveBeenCalledOnce();
    });

    it("resolves identity-bearing query parameters in one batch before constructing the where clause", async () => {
        const tagFindMany = vi.fn(async () => [
            { id: 94, publicId: songTagPublicId }, { id: 95, publicId: otherSongTagPublicId },
        ]);
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant }, { id: 2, name: Permission.login }, { id: 3, name: Permission.view_songs },
        ]);
        const auth = testBandAuthorization({ id: 100 }, effectivePermissions);
        // This target-resolution fixture implements only the band tag delegate.
        const database = { bandSongTag: { findMany: tagFindMany } } as unknown as Parameters<typeof resolvePublicQueryParameters>[3];
        const params = await resolvePublicQueryParameters(db3.xSong, { songTagIds: [songTagPublicId, otherSongTagPublicId] }, auth, database);
        expect(params.songTagIds).toEqual([94, 95]);
        expect(db3.xSong.CalculateWhereClause({ auth, filterModel: { items: [], tableParams: params } })).toBeDefined();
        expect(tagFindMany).toHaveBeenCalledOnce();
    });

    it("defines batch resolution behavior without exposing target existence", async () => {
        const findMany = vi.fn(async () => [{ id: 94, publicId: songTagPublicId }]);
        const database = {
            bandSongTag: { findMany },
        } as any; // Focused delegate double for the identity target.
        const readable = testBandAuthorization({ id: 100 }, new ServerPermissionSet([{ id: 1, name: Permission.login }]));

        await expect(resolvePublicIds(
            db3.xSongTag,
            [songTagPublicId, songTagPublicId],
            readable,
            database,
        )).resolves.toEqual([94]);
        await expect(resolvePublicIds(
            db3.xSongTag,
            [],
            readable,
            database,
        )).resolves.toEqual([]);
        expect(findMany).toHaveBeenCalledOnce();

        findMany.mockResolvedValueOnce([]);
        await expect(resolvePublicIds(
            db3.xSongTag,
            [otherSongTagPublicId],
            readable,
            database,
        )).rejects.toThrow("BandSongTag was not found.");
        await expect(resolvePublicIds(
            db3.xSongTag,
            [otherSongTagPublicId],
            testBandAuthorization({ id: 100 }, new ServerPermissionSet([])),
            database,
        )).rejects.toThrow("BandSongTag was not found.");
        expect(findMany).toHaveBeenCalledTimes(2);

        await expect(resolvePublicIds(
            db3.xSongTag,
            ["not-a-public-id"],
            readable,
            database,
        )).rejects.toThrow("Invalid public ID for BandSongTag.");
    });
});

// MIGRATION_RESTORE: member-profile
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:tests/authorization/publicIdTransport.test.ts:263-313
// Reason: Person-level assignment transport has been replaced by band membership contracts.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 9c90fde68a7b590dc74d10829af9974e82b28c5f061f57c5d6c1154bbc0aa06c
// MIGRATION_REFERENCE_BEGIN
//
//         const projectedUser = projectDB3ModelPublicIds(db3.xUser, {
//             id: 99,
//             publicId: userPublicId(99),
//             instruments: [{
//                 id: 102,
//                 publicId: userInstrumentPublicId,
//                 userId: 99,
//                 user: { id: 99, publicId: userPublicId(99) },
//                 instrumentId: instrument.id,
//                 instrument,
//                 isPrimary: true,
//             }],
//             tags: [{
//                 id: 100,
//                 publicId: userTagAssignmentPublicId,
//                 userId: 99,
//                 user: { id: 99, publicId: userPublicId(99) },
//                 userTagId: 101,
//                 userTag: {
//                     id: 101,
//                     publicId: userTagPublicId,
//                     text: "Members",
//                 },
//             }],
//         }, authorization(Permission.view_users_basic_info));
//         expect(projectedUser.tags[0]).toMatchObject({
//             publicId: userTagAssignmentPublicId,
//             userId: userPublicId(99),
//             userTagId: userTagPublicId,
//             userTag: { publicId: userTagPublicId, text: "Members" },
//         });
//         expect(projectedUser.tags[0]).not.toHaveProperty("id");
//         expect(projectedUser.tags[0].userTag).not.toHaveProperty("id");
//         expect(projectedUser.instruments[0]).toMatchObject({
//             publicId: userInstrumentPublicId,
//             userId: userPublicId(99),
//             instrumentId: instrumentPublicId,
//             instrument: { publicId: instrumentPublicId, name: "Trumpet" },
//             isPrimary: true,
//         });
//         expect(projectedUser.instruments[0]).not.toHaveProperty("id");
//         expect(projectedUser.instruments[0].instrument).not.toHaveProperty("id");
//     });
//
//     it("accepts only public targets for converted-table queries and mutations", () => {
//         expect(() => validateDB3QueryRequest({
//             table: { tableID: db3.xBandInstrumentFunctionalGroup.tableID, tableName: db3.xBandInstrumentFunctionalGroup.tableName },
//             filter: { items: [], publicIds: [publicId] },
//             cmdbQueryContext: "public-id-test",
//         })).not.toThrow();
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: member-profile
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:tests/authorization/publicIdTransport.test.ts:469-486
// Reason: Person-level assignment transport has been replaced by band membership contracts.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 013f9bc81869edb207ef61411bec78de64ccffa088b7c78427bd5cf2c186c68e
// MIGRATION_REFERENCE_BEGIN
//             mutationType: "update",
//             updateId: 95,
//             updateModel: { typeId: songCreditTypePublicId },
//         })).toThrow("updates require updatePublicId");
//         expect(() => validateDB3MutationRequest({
//             tableID: "UserInstrument",
//             tableName: "UserInstrument",
//             mutationType: "update",
//             updatePublicId: userInstrumentPublicId,
//             updateModel: { instrumentId: instrumentPublicId, isPrimary: true },
//         })).not.toThrow();
//         expect(() => validateDB3MutationRequest({
//             tableID: "UserInstrument",
//             tableName: "UserInstrument",
//             mutationType: "update",
//             updateId: 102,
//             updateModel: { isPrimary: true },
//         })).toThrow("updates require updatePublicId");
// MIGRATION_REFERENCE_END
