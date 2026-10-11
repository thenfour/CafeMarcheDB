import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import executeCommand from "@db3/mutations/executeDB3Command";
import query from "@db3/queries/db3queries";
import { bandInstrumentGroupView, bandInstrumentView } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { isPublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationBandId, resetAuthorizationDatabase } from "./support/authorizationSeed";
import { forgeDb3Query } from "./support/db3RequestBuilders";
import { invokeResolver } from "./support/resolverHarness";

const originalPublicId = "originalGroup001";
const instrumentPublicId = "originalInst0001";
const actor = createAuthorizationTestUser("normal", {
    id: 701, permissions: [Permission.login, Permission.admin_instruments],
});
const group = {
    id: 54, bandId: 1, publicId: originalPublicId, nameId: null, descriptionId: null,
    color: null, sortOrder: 1, isHidden: false, globalFunctionalGroupId: null,
};
const text = (value: string) => ({ kind: "set", stringPublicId: null, localeTag: "en-US", value });
const command = (commandID: string, payload: unknown) => invokeResolver(executeCommand,
    { bandPublicId: authorizationBandId, commandID, payload }, createAuthorizationTestContext(actor));

describe("band instrument catalog public-ID mutations", () => {
    beforeEach(() => resetAuthorizationDatabase({
        user: [actor], bandInstrumentFunctionalGroup: [group],
        bandInstrument: [{
            id: 7, bandId: 1, publicId: instrumentPublicId, nameId: null, descriptionId: null,
            autoAssignFileLeafRegex: null, sortOrder: 1, isHidden: false, globalInstrumentId: null,
            functionalGroupId: group.id,
        }], change: [],
    }));

    it("resolves a public mutation target and does not return its natural id", async () => {
        const operation = bandInstrumentGroupView.crud.operations.update.command;
        const result = operation.parseResult(await command(operation.commandID,
            { identity: originalPublicId, patch: { name: text("Brass and winds") } }));
        expect(result).toEqual({ identity: originalPublicId });
        expect(authorizationTestDb.snapshot("bandInstrumentFunctionalGroup")[0]).toMatchObject({ id: group.id, publicId: originalPublicId });
        expect(authorizationTestDb.snapshot("bandDynamicLocalizedStringValue")).toEqual([
            expect.objectContaining({ indexedValue: "Brass and winds", bandId: 1, localeId: 1 }),
        ]);
    });

    it("generates public identity on insert and returns it as the client identity", async () => {
        const operation = bandInstrumentGroupView.crud.operations.create.command;
        const result = operation.parseResult(await command(operation.commandID, { name: text("Strings") }));
        expect(isPublicId(result.identity)).toBe(true);
        expect(result).not.toHaveProperty("id");
        expect(authorizationTestDb.snapshot("bandInstrumentFunctionalGroup")).toEqual(expect.arrayContaining([
            expect.objectContaining({ bandId: 1, publicId: result.identity }),
        ]));
    });

    it("resolves a public foreign key before Prisma receives an instrument update", async () => {
        const operation = bandInstrumentView.crud.operations.update.command;
        await command(operation.commandID, { identity: instrumentPublicId, patch: { functionalGroupId: originalPublicId } });
        expect(authorizationTestDb.snapshot("bandInstrument")[0]!.functionalGroupId).toBe(group.id);
        const result = await invokeResolver(query, forgeDb3Query(bandInstrumentView.entity.tableID, authorizationBandId, {
            table: { tableID: bandInstrumentView.entity.tableID, tableName: bandInstrumentView.entity.tableName, viewID: bandInstrumentView.viewID },
        }), createAuthorizationTestContext(actor));
        const dto = bandInstrumentView.parseDto(result.items[0]);
        expect(dto.functionalGroupId).toBe(originalPublicId);
        expect(dto.publicId).toBe(instrumentPublicId);
        expect(dto).not.toHaveProperty("id");
    });
});
