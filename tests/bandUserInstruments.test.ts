import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { bandUserInstrumentsCommand, bandUserInstrumentsView, xBandUserInstrument } from "src/core/db3/shared/entities/user/bandUserInstruments";
import { xBandUser } from "src/core/db3/shared/entities/user/bandUser";
import { prepareDB3ReadSelection } from "src/core/db3/shared/core/db3ReadSelection";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { testBandAuthorization } from "./support/serverAuthorization";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";

const membershipId = parsePublicId<"BandUser">("Membership000001");
const instrumentId = parsePublicId<"Instrument">("Instrument000001");

describe("band membership instrument contracts", () => {
    it("registers the aggregate command on the membership and disables standalone assignment CRUD", () => {
        expect(getDB3CommandHandler(bandUserInstrumentsCommand.commandID).command).toBe(bandUserInstrumentsCommand);
        expect(bandUserInstrumentsCommand.entity).toBe(xBandUser);
        expect(xBandUserInstrument.deletePolicy).toBe("disabled");
        expect(xBandUserInstrument.bandScope?.via).toEqual({ relation: "bandUser", ownerUserMember: "userId" });
    });

    it("accepts explicit empty replacement and an assigned-instrument primary request", () => {
        expect(bandUserInstrumentsCommand.serialize({ kind: "replace", membershipId, instrumentIds: [] })).toEqual({ kind: "replace", membershipId, instrumentIds: [] });
        expect(bandUserInstrumentsCommand.serialize({ kind: "setPrimary", membershipId, instrumentId })).toEqual({ kind: "setPrimary", membershipId, instrumentId });
    });

    it.each([
        { kind: "replace", membershipId: 12, instrumentIds: [] },
        { kind: "replace", membershipId, instrumentIds: [12] },
        { kind: "replace", membershipId, instrumentIds: [instrumentId, instrumentId] },
        { kind: "replace", membershipId, instrumentIds: [], userId: "User000000000001" },
        { kind: "replace", membershipId, instrumentIds: [], bandId: 1 },
        { kind: "setPrimary", membershipId, instrumentId, isPrimary: true },
    ])("rejects numeric, duplicate, and undeclared ownership/primary payloads %#", payload => {
        expect(() => bandUserInstrumentsCommand.parseDto(payload)).toThrow();
    });

    it("fetches parent ownership without fetching unrelated membership metadata", () => {
        const plan = prepareDB3ReadSelection(xBandUserInstrument, { select: { publicId: true } });
        expect(plan.selection.select?.bandUser).toEqual({ select: { bandId: true, userId: true, isDeleted: true } });
        expect(plan.stripSupportFields({ publicId: "Assignment000001", bandUser: { bandId: 1, userId: 2 } })).toEqual({ publicId: "Assignment000001" });
    });

    it("preserves an explicitly requested child selection when the resolved query also needs that relation", () => {
        const auth = testBandAuthorization(null, new ServerPermissionSet([]));
        const selection = bandUserInstrumentsView.getSelectionArgs({ filter: {}, auth });
        const plan = prepareDB3ReadSelection(xBandUser, selection, ["bandUserInstruments"]);
        expect(plan.selection.select?.bandUserInstruments).toMatchObject({ select: { publicId: true, isPrimary: true } });
        expect(plan.stripSupportFields({ publicId: membershipId, bandId: 1, userId: "User000000000001", bandUserInstruments: [] })).toHaveProperty("bandUserInstruments", []);
    });
});
