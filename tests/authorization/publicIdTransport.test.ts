import { describe, expect, it } from "vitest";
import * as db3 from "@db3/db3";
import { projectDB3ModelPublicIds } from "@db3/server/db3PublicIds";
import { validateDB3MutationRequest, validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const publicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");
const instrumentId = 7;
const group = {
    id: 54,
    publicId,
    name: "Brass",
    description: "Brass instruments",
    color: "orange",
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

describe("InstrumentFunctionalGroup public-ID transport", () => {
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
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: group.id,
            functionalGroup: group,
            instrumentTags: [],
        };
        const publicData = authorization(Permission.login);

        const projectedInstrument = projectDB3ModelPublicIds(db3.xInstrument, instrument, publicData);
        expect(projectedInstrument.functionalGroupId).toBe(publicId);
        expect(projectedInstrument.functionalGroup).toMatchObject({ publicId, name: "Brass" });
        expect(projectedInstrument.functionalGroup).not.toHaveProperty("id");

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
            tableID: "Instrument",
            tableName: "Instrument",
            mutationType: "update",
            updateId: instrumentId,
            updateModel: { functionalGroupId: publicId },
        })).not.toThrow();
    });
});
