import { describe, expect, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { projectDB3ModelPublicIds, resolvePublicForeignIds, resolvePublicIds } from "@db3/server/db3PublicIds";
import { queryTable } from "@db3/server/db3QueryCore";
import { validateDB3MutationRequest, validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const publicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");
const tagPublicId = parsePublicId<"InstrumentTag">("AbCdEfGhIjKlMn02");
const tagAssociationPublicId = parsePublicId<"InstrumentTagAssociation">("AbCdEfGhIjKlMn03");
const songTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn04");
const otherSongTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn05");
const songTagAssociationPublicId = parsePublicId<"SongTagAssociation">("AbCdEfGhIjKlMn06");
const instrumentPublicId = parsePublicId<"Instrument">("AbCdEfGhIjKlMn07");
const fileTagPublicId = parsePublicId<"FileTag">("AbCdEfGhIjKlMn08");
const fileTagAssociationPublicId = parsePublicId<"FileTagAssignment">("AbCdEfGhIjKlMn09");
const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("AbCdEfGhIjKlMn10");
const wikiPageTagAssignmentPublicId = parsePublicId<"WikiPageTagAssignment">("AbCdEfGhIjKlMn11");
const userTagPublicId = parsePublicId<"UserTag">("AbCdEfGhIjKlMn12");
const userTagAssignmentPublicId = parsePublicId<"UserTagAssignment">("AbCdEfGhIjKlMn13");
const songCreditTypePublicId = parsePublicId<"SongCreditType">("AbCdEfGhIjKlMn14");
const songCreditPublicId = parsePublicId<"SongCredit">("AbCdEfGhIjKlMn15");
const userInstrumentPublicId = parsePublicId<"UserInstrument">("AbCdEfGhIjKlMn16");
const instrumentId = 7;
const group = {
    id: 54,
    publicId,
    name: "Brass",
    description: "Brass instruments",
    color: "orange",
    sortOrder: 1,
};
const tag = {
    id: 20,
    publicId: tagPublicId,
    text: "Acoustic",
    description: "Does not require amplification",
    color: null,
    significance: null,
    sortOrder: 1,
};

const authorization = (...permissions: Permission[]): db3.DB3Authorization => ({
    userId: 100,
    effectivePermissions: new PermissionSet([
        { id: 1, name: Permission.always_grant },
        ...permissions.map((name, index) => ({ id: index + 2, name })),
    ]),
});

const sanitizeGroup = (publicData: db3.DB3Authorization) => {
    const result = db3.xInstrumentFunctionalGroup.authorizeAndSanitize({
        contextDesc: "public-id-transport-test",
        model: group,
        rowMode: "view",
        fallbackOwnerId: null,
        publicData,
    });
    expect(result.rowIsAuthorized).toBe(true);
    return projectDB3ModelPublicIds(db3.xInstrumentFunctionalGroup, result.authorizedModel, publicData);
};

const sanitizeTag = (publicData: db3.DB3Authorization) => {
    const result = db3.xInstrumentTag.authorizeAndSanitize({
        contextDesc: "public-id-transport-test",
        model: tag,
        rowMode: "view",
        fallbackOwnerId: null,
        publicData,
    });
    expect(result.rowIsAuthorized).toBe(true);
    return projectDB3ModelPublicIds(db3.xInstrumentTag, result.authorizedModel, publicData);
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

        const expectedTag = {
            publicId: tagPublicId,
            text: tag.text,
            description: tag.description,
            color: tag.color,
            significance: tag.significance,
            sortOrder: tag.sortOrder,
        };
        expect(sanitizeTag(authorization(Permission.login))).toEqual(expectedTag);
        expect(sanitizeTag(authorization(Permission.login, Permission.sysadmin))).toEqual(expectedTag);
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
            instrumentTags: [{
                id: 70,
                publicId: tagAssociationPublicId,
                instrumentId,
                tagId: tag.id,
                tag,
            }],
        };
        const publicData = authorization(Permission.login);

        const projectedInstrument = projectDB3ModelPublicIds(db3.xInstrument, instrument, publicData);
        expect(projectedInstrument.publicId).toBe(instrumentPublicId);
        expect(projectedInstrument).not.toHaveProperty("id");
        expect(projectedInstrument.functionalGroupId).toBe(publicId);
        expect(projectedInstrument.functionalGroup).toMatchObject({ publicId, name: "Brass" });
        expect(projectedInstrument.functionalGroup).not.toHaveProperty("id");
        expect(projectedInstrument.instrumentTags[0]).toMatchObject({
            publicId: tagAssociationPublicId,
            tagId: tagPublicId,
            tag: { publicId: tagPublicId, text: "Acoustic" },
        });
        expect(projectedInstrument.instrumentTags[0]).not.toHaveProperty("id");
        expect(projectedInstrument.instrumentTags[0].tag).not.toHaveProperty("id");

        const projectedFile = projectDB3ModelPublicIds(db3.xFile, {
            id: 90,
            tags: [{
                id: 92,
                publicId: fileTagAssociationPublicId,
                fileId: 90,
                fileTagId: 21,
                fileTag: {
                    id: 21,
                    publicId: fileTagPublicId,
                    text: "Partition",
                },
            }],
            taggedInstruments: [{
                id: 91,
                fileId: 90,
                instrumentId: instrument.id,
                instrument,
            }],
        }, publicData);
        const nestedInstrument = projectedFile.taggedInstruments[0].instrument;
        expect(projectedFile.taggedInstruments[0].instrumentId).toBe(instrumentPublicId);
        expect(nestedInstrument.publicId).toBe(instrumentPublicId);
        expect(nestedInstrument).not.toHaveProperty("id");
        expect(nestedInstrument.functionalGroupId).toBe(publicId);
        expect(nestedInstrument.functionalGroup).not.toHaveProperty("id");
        expect(projectedFile.tags[0]).toMatchObject({
            publicId: fileTagAssociationPublicId,
            fileTagId: fileTagPublicId,
            fileTag: { publicId: fileTagPublicId, text: "Partition" },
        });
        expect(projectedFile.tags[0]).not.toHaveProperty("id");
        expect(projectedFile.tags[0].fileTag).not.toHaveProperty("id");

        const projectedSong = projectDB3ModelPublicIds(db3.xSong, {
            id: 92,
            tags: [{
                id: 93,
                publicId: songTagAssociationPublicId,
                songId: 92,
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
                userId: 100,
                typeId: 96,
                type: {
                    id: 96,
                    publicId: songCreditTypePublicId,
                    text: "Composer",
                },
            }],
        }, authorization(Permission.view_songs));
        expect(projectedSong.tags[0]).toMatchObject({
            publicId: songTagAssociationPublicId,
            tagId: songTagPublicId,
            tag: { publicId: songTagPublicId, text: "March" },
        });
        expect(projectedSong.tags[0]).not.toHaveProperty("id");
        expect(projectedSong.tags[0].tag).not.toHaveProperty("id");
        expect(projectedSong.credits[0]).toMatchObject({
            publicId: songCreditPublicId,
            songId: 92,
            userId: 100,
            typeId: songCreditTypePublicId,
            type: { publicId: songCreditTypePublicId, text: "Composer" },
        });
        expect(projectedSong.credits[0]).not.toHaveProperty("id");
        expect(projectedSong.credits[0].type).not.toHaveProperty("id");

        const projectedWikiPage = projectDB3ModelPublicIds(db3.xWikiPage, {
            id: 96,
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

        const projectedUser = projectDB3ModelPublicIds(db3.xUser, {
            id: 99,
            instruments: [{
                id: 102,
                publicId: userInstrumentPublicId,
                userId: 99,
                instrumentId: instrument.id,
                instrument,
                isPrimary: true,
            }],
            tags: [{
                id: 100,
                publicId: userTagAssignmentPublicId,
                userId: 99,
                userTagId: 101,
                userTag: {
                    id: 101,
                    publicId: userTagPublicId,
                    text: "Members",
                },
            }],
        }, authorization(Permission.view_users_basic_info));
        expect(projectedUser.tags[0]).toMatchObject({
            publicId: userTagAssignmentPublicId,
            userId: 99,
            userTagId: userTagPublicId,
            userTag: { publicId: userTagPublicId, text: "Members" },
        });
        expect(projectedUser.tags[0]).not.toHaveProperty("id");
        expect(projectedUser.tags[0].userTag).not.toHaveProperty("id");
        expect(projectedUser.instruments[0]).toMatchObject({
            publicId: userInstrumentPublicId,
            userId: 99,
            instrumentId: instrumentPublicId,
            instrument: { publicId: instrumentPublicId, name: "Trumpet" },
            isPrimary: true,
        });
        expect(projectedUser.instruments[0]).not.toHaveProperty("id");
        expect(projectedUser.instruments[0].instrument).not.toHaveProperty("id");
    });

    it("accepts only public targets for converted-table queries and mutations", () => {
        expect(() => validateDB3QueryRequest({
            table: { tableID: "InstrumentFunctionalGroup", tableName: "InstrumentFunctionalGroup" },
            filter: { items: [], publicIds: [publicId] },
            cmdbQueryContext: "public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: "InstrumentTag", tableName: "InstrumentTag" },
            filter: { items: [], publicIds: [tagPublicId] },
            cmdbQueryContext: "public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: {
                tableID: "InstrumentTagAssociation",
                tableName: "InstrumentTagAssociation",
            },
            filter: { items: [], publicIds: [tagAssociationPublicId] },
            cmdbQueryContext: "public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: "Instrument", tableName: "Instrument" },
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
            filter: { items: [], tableParams: { fileTagIds: [21] } },
            cmdbQueryContext: "file-tag-natural-id-test",
        })).toThrow("Expected string, received number");
        expect(() => validateDB3QueryRequest({
            table: { tableID: "UserTag", tableName: "UserTag" },
            filter: { items: [], tableParams: { ids: [userTagPublicId] } },
            cmdbQueryContext: "user-tag-public-id-test",
        })).not.toThrow();
        expect(() => validateDB3QueryRequest({
            table: { tableID: "UserTag", tableName: "UserTag" },
            filter: { items: [], tableParams: { ids: [101] } },
            cmdbQueryContext: "user-tag-natural-id-test",
        })).toThrow("Expected string, received number");

        expect(() => validateDB3MutationRequest({
            tableID: "InstrumentFunctionalGroup",
            tableName: "InstrumentFunctionalGroup",
            mutationType: "update",
            updatePublicId: publicId,
            updateModel: { name: "Winds" },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "InstrumentFunctionalGroup",
            tableName: "InstrumentFunctionalGroup",
            mutationType: "update",
            updateId: group.id,
            updateModel: { name: "Winds" },
        })).toThrow("updates require updatePublicId");
        expect(() => validateDB3MutationRequest({
            tableID: "InstrumentFunctionalGroup",
            tableName: "InstrumentFunctionalGroup",
            mutationType: "insert",
            insertModel: { name: "Winds", publicId },
        })).toThrow("field 'publicId' is server-generated");

        expect(() => validateDB3MutationRequest({
            tableID: "InstrumentTag",
            tableName: "InstrumentTag",
            mutationType: "update",
            updatePublicId: tagPublicId,
            updateModel: { text: "Unplugged" },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "InstrumentTag",
            tableName: "InstrumentTag",
            mutationType: "update",
            updateId: tag.id,
            updateModel: { text: "Unplugged" },
        })).toThrow("updates require updatePublicId");

        expect(() => validateDB3MutationRequest({
            tableID: "InstrumentTagAssociation",
            tableName: "InstrumentTagAssociation",
            mutationType: "update",
            updatePublicId: tagAssociationPublicId,
            updateModel: { tagId: tagPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "InstrumentTagAssociation",
            tableName: "InstrumentTagAssociation",
            mutationType: "update",
            updateId: 70,
            updateModel: { tagId: tagPublicId },
        })).toThrow("updates require updatePublicId");

        expect(() => validateDB3MutationRequest({
            tableID: "Instrument",
            tableName: "Instrument",
            mutationType: "update",
            updatePublicId: instrumentPublicId,
            updateModel: { functionalGroupId: publicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "Instrument",
            tableName: "Instrument",
            mutationType: "update",
            updateId: instrumentId,
            updateModel: { functionalGroupId: publicId },
        })).toThrow("updates require updatePublicId");

        expect(() => validateDB3MutationRequest({
            tableID: "SongTag",
            tableName: "SongTag",
            mutationType: "update",
            updatePublicId: songTagPublicId,
            updateModel: { text: "Processional" },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "SongTagAssociation",
            tableName: "SongTagAssociation",
            mutationType: "update",
            updatePublicId: songTagAssociationPublicId,
            updateModel: { tagId: songTagPublicId },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileTag",
            tableName: "FileTag",
            mutationType: "update",
            updatePublicId: fileTagPublicId,
            updateModel: { text: "Chart" },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "FileTagAssignment",
            tableName: "FileTagAssignment",
            mutationType: "update",
            updatePublicId: fileTagAssociationPublicId,
            updateModel: { fileTagId: fileTagPublicId },
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
            tableID: "UserTag",
            tableName: "UserTag",
            mutationType: "update",
            updatePublicId: userTagPublicId,
            updateModel: { text: "Current members" },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "UserTagAssignment",
            tableName: "UserTagAssignment",
            mutationType: "update",
            updatePublicId: userTagAssignmentPublicId,
            updateModel: { userTagId: userTagPublicId },
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
            tableID: "UserInstrument",
            tableName: "UserInstrument",
            mutationType: "update",
            updatePublicId: userInstrumentPublicId,
            updateModel: { instrumentId: instrumentPublicId, isPrimary: true },
        })).not.toThrow();
        expect(() => validateDB3MutationRequest({
            tableID: "UserInstrument",
            tableName: "UserInstrument",
            mutationType: "update",
            updateId: 102,
            updateModel: { isPrimary: true },
        })).toThrow("updates require updatePublicId");
    });

    it("resolves an Event invitation tag public ID before persistence", async () => {
        const findMany = vi.fn(async () => [{ id: 101, publicId: userTagPublicId }]);
        const resolved = await resolvePublicForeignIds(
            db3.xEvent,
            { expectedAttendanceUserTagId: userTagPublicId },
            authorization(Permission.login, Permission.view_users_basic_info),
            { UserTag: { findMany } } as any,
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

    it("resolves identity-bearing query parameters once before building the Prisma where clause", async () => {
        const tagFindMany = vi.fn(async () => [
            { id: 94, publicId: songTagPublicId },
            { id: 95, publicId: otherSongTagPublicId },
        ]);
        const songFindMany = vi.fn(async () => []);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.view_songs },
        ]);

        const result = await queryTable({
            table: { tableID: "Song", tableName: "Song" },
            filter: {
                items: [],
                tableParams: { songTagIds: [songTagPublicId, otherSongTagPublicId] },
            },
            orderBy: undefined,
            cmdbQueryContext: "song-tag-query-parameter-resolution-test",
        }, {
            // RequestAuthorization carries the full session user; this query only reads its ID.
            user: { id: 100 } as any,
            effectivePermissions,
        }, {
            SongTag: { findMany: tagFindMany },
            Song: { findMany: songFindMany },
        } as any); // Focused delegate doubles intentionally implement only the queried models.

        expect(tagFindMany).toHaveBeenCalledOnce();
        expect(songFindMany).toHaveBeenCalledOnce();
        expect(JSON.stringify(result.where)).toContain('"tagId":94');
        expect(JSON.stringify(result.where)).toContain('"tagId":95');
        expect(JSON.stringify(result.where)).not.toContain(songTagPublicId);
    });

    it("defines batch resolution behavior without exposing target existence", async () => {
        const findMany = vi.fn(async () => [{ id: 94, publicId: songTagPublicId }]);
        const database = {
            SongTag: { findMany },
        } as any; // Focused delegate double for the identity target.
        const readable = authorization(Permission.view_songs);

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
        )).rejects.toThrow("SongTag was not found.");
        await expect(resolvePublicIds(
            db3.xSongTag,
            [otherSongTagPublicId],
            authorization(Permission.login),
            database,
        )).rejects.toThrow("SongTag was not found.");
        expect(findMany).toHaveBeenCalledTimes(2);

        await expect(resolvePublicIds(
            db3.xSongTag,
            ["not-a-public-id"],
            readable,
            database,
        )).rejects.toThrow("Invalid public ID for SongTag.");
    });
});
