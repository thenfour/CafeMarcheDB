import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { bandUserTagsCommand, xBandUserTagAssignment } from "src/core/db3/shared/entities/user/bandUserTags";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";

const membershipId = parsePublicId<"BandUser">("Membership000001");
const tagId = parsePublicId<"UserTag">("UserTag000000001");

describe("member tag transport", () => {
    it("registers the aggregate assignment command and supports removing every tag", () => {
        expect(getDB3CommandHandler(bandUserTagsCommand.commandID).command).toBe(bandUserTagsCommand);
        expect(bandUserTagsCommand.serialize({ membershipId, tagIds: [] })).toEqual({ membershipId, tagIds: [] });
        expect(xBandUserTagAssignment.deletePolicy).toBe("disabled");
    });

    it.each([
        { membershipId: 12, tagIds: [] },
        { membershipId, tagIds: [12] },
        { membershipId, tagIds: [tagId, tagId] },
        { membershipId, tagIds: [], bandId: 1 },
        { membershipId, tagIds: [], userId: "User000000000001" },
    ])("rejects malformed identities, duplicate tags and undeclared ownership %#", payload => {
        expect(() => bandUserTagsCommand.parseDto(payload)).toThrow();
    });

});
