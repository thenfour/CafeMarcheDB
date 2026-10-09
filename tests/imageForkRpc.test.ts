import { afterEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import * as authorization from "src/auth/server/serverAuthorization";
import forkImageMutation from "src/core/db3/mutations/forkImage";
import * as images from "src/core/db3/server/imageFork";
import * as storage from "src/core/db3/server/fileStorage";
import { createAuthorizationPersona, createAuthorizationTestContext } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";

const input = {
    bandPublicId: parsePublicId<"Band">("ImageForkBand001"),
    parentFileId: parsePublicId<"File">("ImageForkFile001"),
    outputType: "png", quality: 80,
    editParams: { cropBegin: { x: 0, y: 0 }, cropSize: null, rotate: 0 },
};

describe("image fork RPC boundary", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("loads the requested band and passes only validated fields to the transactional owner", async () => {
        const persona = createAuthorizationPersona("normal", { permissions: [Permission.login, Permission.upload_files] });
        const load = vi.spyOn(authorization, "loadAuthorization").mockResolvedValue(persona.schemaAuthorization);
        vi.spyOn(storage, "requireFileStorageDirectory").mockReturnValue("private-fixture");
        const fork = vi.spyOn(images, "forkImage").mockResolvedValue({ publicId: input.parentFileId });
        expect(await invokeResolver(forkImageMutation, input, persona.ctx)).toEqual({ publicId: input.parentFileId });
        expect(load.mock.calls[0]?.[0]).toBe(persona.ctx.session);
        expect(load.mock.calls[0]?.[1]).toBe(input.bandPublicId);
        expect(fork.mock.calls[0]?.[1]).toBe(persona.schemaAuthorization);
        expect(fork.mock.calls[0]?.[2]).toEqual(input);
        expect(fork.mock.calls[0]?.[3]).toBe("private-fixture");
        await expect(invokeResolver(forkImageMutation, { ...input, storedLeafName: "forged" }, persona.ctx)).rejects.toThrow();
        expect(fork).toHaveBeenCalledOnce();
    });

    it("rejects fresh upload denial before storage configuration or processing", async () => {
        const persona = createAuthorizationPersona("normal", { permissions: [Permission.login] });
        vi.spyOn(authorization, "loadAuthorization").mockResolvedValue(persona.schemaAuthorization);
        const configure = vi.spyOn(storage, "requireFileStorageDirectory");
        const fork = vi.spyOn(images, "forkImage");
        await expect(invokeResolver(forkImageMutation, input, persona.ctx)).rejects.toThrow("upload_files");
        expect(configure).not.toHaveBeenCalled();
        expect(fork).not.toHaveBeenCalled();
    });

    it("requires login before parsing or authorization reads", async () => {
        const context = createAuthorizationTestContext(null);
        const load = vi.spyOn(authorization, "loadAuthorization");
        await expect(invokeResolver(forkImageMutation, {}, context)).rejects.toThrow("login");
        expect(load).not.toHaveBeenCalled();
    });
});
