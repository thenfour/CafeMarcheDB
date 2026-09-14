import { describe, expect, it } from "vitest";
import { isUserInvitedToEvent } from "shared/eventInvitation";
import { getEventResponseForUser } from "src/core/db3/shared/schema/eventAPI";
import type { EventResponses_MinimalEvent, EventResponses_MinimalEventUserResponse } from "src/core/db3/shared/schema/event";
import type { UserWithInstrumentsPayload } from "src/core/db3/shared/schema/prismArgs";
import type { DashboardContextDataBase } from "src/core/components/dashboardContext/dashboardContextTypes";

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
    const user = { id: 10, instruments: [] } as unknown as UserWithInstrumentsPayload;
    const resolve = (responses: EventResponses_MinimalEventUserResponse[], invitedUserIds: number[]) =>
        getEventResponseForUser({
            user,
            event: { id: 1, responses, segments: [] } satisfies EventResponses_MinimalEvent,
            defaultInvitationUserIds: new Set(invitedUserIds),
            dashboardContext: {} as DashboardContextDataBase,
            userMap: [user],
            makeMockEventUserResponse: (_event, user, isInvited) => ({
                id: -1, userId: user.id, isInvited, userComment: "", instrumentId: null,
            }),
        });

    it("resolves invitation through the tag while preserving the stored individual flag", () => {
        const response = { id: 1, userId: user.id, isInvited: false, userComment: "", instrumentId: null };
        const result = resolve([response], [user.id]);
        expect(result?.isInvited).toBe(true);
        expect(result?.response).toBe(response);
        expect(result?.response.isInvited).toBe(false);
    });

    it.each([true, false])("resolves missing response rows for tag membership %s", tagMember => {
        const result = resolve([], tagMember ? [user.id] : []);
        expect(result?.isInvited).toBe(tagMember);
        expect(result?.isRelevantForDisplay).toBe(tagMember);
        expect(result?.response.id).toBe(-1);
    });
});
