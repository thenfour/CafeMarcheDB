import { describe, expect, it } from "vitest";
import { isUserInvitedToEvent } from "shared/eventInvitation";
import { getEventResponseForUser, getEventSegmentResponseForSegmentAndUser } from "src/core/db3/shared/schema/eventAPI";
import type { EventResponses_MinimalEvent, EventResponses_MinimalEventUserResponse } from "src/core/db3/shared/schema/event";
import type { EventParticipant } from "src/core/db3/shared/entities/user/eventParticipant";
import { parsePublicId } from "shared/publicId";
import { eventPublicId, segmentPublicId } from "./support/eventResponseFixtures";
import { userPublicId } from "./support/userFixtures";

describe("event invitation", () => {
    it.each([
        { tagMember: true, individual: true, invited: true },
        { tagMember: true, individual: false, invited: true },
        { tagMember: true, individual: null, invited: true },
        { tagMember: true, individual: undefined, invited: true },
        { tagMember: false, individual: true, invited: true },
        { tagMember: false, individual: false, invited: false },
        { tagMember: false, individual: null, invited: false },
        { tagMember: false, individual: undefined, invited: false },
    ])("resolves tag membership and individual invitations: %j", ({ tagMember, individual, invited }) => {
        expect(isUserInvitedToEvent({
            userId: 10,
            defaultInvitationUserIds: new Set(tagMember ? [10] : []),
            responses: individual === undefined ? [] : [{ userId: 10, isInvited: individual }],
        })).toBe(invited);
    });

    it("ignores another user's invitation and tag membership", () => {
        expect(isUserInvitedToEvent({
            userId: 10,
            defaultInvitationUserIds: new Set([20]),
            responses: [{ userId: 20, isInvited: true }, { userId: 10, isInvited: null }],
        })).toBe(false);
    });
});

describe("website invitation resolution", () => {
    // No instrument lookup is needed for this user, keeping the fixture focused on invitations.
    const user: EventParticipant = {
        publicId: userPublicId(10), membershipId: parsePublicId<"BandUser">("InviteMember0010"),
        name: "Invited member", cssClass: null, bandUserInstruments: [], bandUserTagAssignments: [],
    };
    const resolve = (responses: EventResponses_MinimalEventUserResponse[], invitedUserIds: EventParticipant["membershipId"][]) =>
        getEventResponseForUser({
            user,
            event: { publicId: eventPublicId(1), responses, segments: [] } satisfies EventResponses_MinimalEvent,
            defaultInvitationMembershipIds: new Set(invitedUserIds),
            dashboardContext: { instrument: { find: () => undefined } },
            userMap: [user],
            makeMockEventUserResponse: (_event, user, isInvited) => ({
                id: -1, bandUserId: user.membershipId, isInvited, userComment: "", bandInstrumentId: null,
            }),
        });

    it("resolves invitation through the tag while preserving the stored individual flag", () => {
        const response = { id: 1, bandUserId: user.membershipId, isInvited: false, userComment: "", bandInstrumentId: null };
        const result = resolve([response], [user.membershipId]);
        expect(result?.isInvited).toBe(true);
        expect(result?.response).toBe(response);
        expect(result?.response.isInvited).toBe(false);
    });

    it.each([true, false])("resolves missing response rows for tag membership %s", tagMember => {
        const result = resolve([], tagMember ? [user.membershipId] : []);
        expect(result?.isInvited).toBe(tagMember);
        expect(result?.isRelevantForDisplay).toBe(tagMember);
        expect(result?.response).toMatchObject({ bandUserId: user.membershipId, isInvited: tagMember });
    });

    it("ignores another membership's invitation, instrument, comment and segment answer for the same person", () => {
        const otherMembership = parsePublicId<"BandUser">("InviteMember0020");
        const result = resolve([{ bandUserId: otherMembership, bandInstrumentId: parsePublicId<"Instrument">("OtherInstrument1"),
            isInvited: true, userComment: "Other band's comment" }], [otherMembership]);
        expect(result).toMatchObject({ isInvited: false, instrument: null,
            response: { bandUserId: user.membershipId, userComment: "", bandInstrumentId: null } });
        const segment = { publicId: segmentPublicId(1), name: "Set", startsAt: null, durationMillis: BigInt(0), isAllDay: true, statusId: null,
            responses: [{ bandUserId: otherMembership, attendanceId: null }] };
        const response = getEventSegmentResponseForSegmentAndUser({ user, segment, expectedAttendanceTag: null,
            makeMockEventSegmentResponse: (_segment, participant) => ({ bandUserId: participant.membershipId, attendanceId: null }) });
        expect(response?.response).toEqual({ bandUserId: user.membershipId, attendanceId: null });
        expect(response?.response).not.toBe(segment.responses[0]);
    });
});
