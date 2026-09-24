import { describe, expect, it } from "vitest";
import * as db3 from "@db3/db3";
import { projectDB3ModelPublicIds } from "@db3/server/db3PublicIds";
import { validateDB3MutationRequest, validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const publicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");
const tagPublicId = parsePublicId<"InstrumentTag">("AbCdEfGhIjKlMn02");
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
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: group.id,
            functionalGroup: group,
            instrumentTags: [{
                id: 70,
                instrumentId,
                tagId: tag.id,
                tag,
            }],
        };
        const publicData = authorization(Permission.login);

        const projectedInstrument = projectDB3ModelPublicIds(db3.xInstrument, instrument, publicData);
        expect(projectedInstrument.functionalGroupId).toBe(publicId);
        expect(projectedInstrument.functionalGroup).toMatchObject({ publicId, name: "Brass" });
        expect(projectedInstrument.functionalGroup).not.toHaveProperty("id");
        expect(projectedInstrument.instrumentTags[0]).toMatchObject({
            id: 70,
            tagId: tagPublicId,
            tag: { publicId: tagPublicId, text: "Acoustic" },
        });
        expect(projectedInstrument.instrumentTags[0].tag).not.toHaveProperty("id");

        const projectedFile = projectDB3ModelPublicIds(db3.xFile, {
            id: 90,
            taggedInstruments: [{
                id: 91,
                fileId: 90,
                instrumentId: instrument.id,
                instrument,
            }],
        }, publicData);
        const nestedInstrument = projectedFile.taggedInstruments[0].instrument;
        expect(nestedInstrument.functionalGroupId).toBe(publicId);
        expect(nestedInstrument.functionalGroup).not.toHaveProperty("id");
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
            table: { tableID: "Instrument", tableName: "Instrument" },
            filter: { items: [], publicIds: [publicId] },
            cmdbQueryContext: "public-id-test",
        })).toThrow("does not use public IDs");

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
            tableID: "Instrument",
            tableName: "Instrument",
            mutationType: "update",
            updateId: instrumentId,
            updateModel: { functionalGroupId: publicId },
        })).not.toThrow();
    });
});
