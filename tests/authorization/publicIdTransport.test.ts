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
                bandUserId: 110,
                bandUser: { id: 110, publicId: parsePublicId<"BandUser">("TransportMember1"), userId: 100,
                    user: { id: 100, publicId: userPublicId(100), name: "Ada" } },
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
                bandInstrumentId: instrument.id,
                bandInstrument: instrument,
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
        const nestedInstrument = projectedFile.taggedInstruments[0].bandInstrument;
        expect(projectedFile.taggedInstruments[0].bandInstrumentId).toBe(instrumentPublicId);
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
            bandUserId: "TransportMember1",
            bandUser: { publicId: "TransportMember1", userId: userPublicId(100),
                user: { publicId: userPublicId(100), name: "Ada" } },
        });
        expect(projectedFile.taggedUsers[0]).not.toHaveProperty("userId");
        expect(projectedFile.taggedUsers[0].bandUser).not.toHaveProperty("id");
        expect(projectedFile.taggedUsers[0].bandUser.user).not.toHaveProperty("id");
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
                bandSongTagId: 94,
                tag: {
                    id: 94,
                    publicId: songTagPublicId,
                    name: null,
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
                    name: "Composer",
                },
            }],
        }, authorization(Permission.view_songs, Permission.view_users_basic_info));
        expect(projectedSong.tags[0]).toMatchObject({
            publicId: songTagAssociationPublicId,
            songId: songPublicId,
            bandSongTagId: songTagPublicId,
            tag: { publicId: songTagPublicId, name: null },
        });
        expect(projectedSong.tags[0]).not.toHaveProperty("id");
        expect(projectedSong.tags[0].tag).not.toHaveProperty("id");
        expect(projectedSong.credits[0]).toMatchObject({
            publicId: songCreditPublicId,
            songId: songPublicId,
            userId: userPublicId(100),
            typeId: songCreditTypePublicId,
            type: { publicId: songCreditTypePublicId, name: "Composer" },
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
                bandWikiPageTagId: 98,
                tag: {
                    id: 98,
                    publicId: wikiPageTagPublicId,
                    name: "Policy",
                },
            }],
        }, authorization(Permission.view_wiki_pages));
        expect(projectedWikiPage.tags[0]).toMatchObject({
            publicId: wikiPageTagAssignmentPublicId,
            bandWikiPageTagId: wikiPageTagPublicId,
            tag: { publicId: wikiPageTagPublicId, name: "Policy" },
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
            tableID: "BandSongTagAssociation",
            tableName: "BandSongTagAssociation",
            mutationType: "update",
            updatePublicId: songTagAssociationPublicId,
            updateModel: { bandSongTagId: songTagPublicId },
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
            tableID: "BandWikiPageTag",
            tableName: "bandWikiPageTag",
            mutationType: "update",
            updatePublicId: wikiPageTagPublicId,
            updateModel: { name: { kind: "set", localeTag: "en-US", stringPublicId: null, value: "Procedure" } },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "WikiPageTagAssignment",
            tableName: "WikiPageTagAssignment",
            mutationType: "update",
            updatePublicId: wikiPageTagAssignmentPublicId,
            updateModel: { bandWikiPageTagId: wikiPageTagPublicId },
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
            updateModel: { name: { kind: "set", localeTag: "en-US", stringPublicId: null, value: "Composer" } },
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
            updateModel: { bandUserId: parsePublicId<"BandUser">("TransportMember1") },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileUserTag", tableName: "FileUserTag", mutationType: "update",
            updatePublicId: fileUserTagPublicId, updateModel: { userId: 100 },
        })).toThrow("unknown mutation field 'userId'");
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
            updateModel: { bandInstrumentId: instrumentPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileInstrumentTag", tableName: "FileInstrumentTag", mutationType: "update",
            updatePublicId: fileInstrumentTagPublicId, updateModel: { instrumentId: instrumentPublicId },
        })).toThrow("unknown mutation field 'instrumentId'");
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
            authorization(Permission.public, Permission.view_songs),
            { SongCreditType: { findMany } } as unknown as Parameters<typeof resolvePublicForeignIds>[3], // This fixture provides only the catalog identity lookup.
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

        const unreadable = testBandAuthorization({ id: 100 }, new ServerPermissionSet([]));
        await expect(resolvePublicIds(db3.xSong, [], unreadable, database)).resolves.toEqual([]);
        await expect(resolvePublicIds(db3.xSong, [songPublicId], unreadable, database)).rejects.toThrow("Song was not found.");
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
        )).rejects.toThrow('One or more public IDs are invalid on "BandSongTag"."publicId"');
    });
});
