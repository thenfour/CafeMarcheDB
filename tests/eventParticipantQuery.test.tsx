// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import type { DB3QueryContextInput } from "src/core/db3/components/useDB3Context";
import { eventParticipantFromMembership, eventParticipantView, type EventParticipant } from "src/core/db3/shared/entities/user/eventParticipant";
import { useEventParticipants } from "src/core/components/event/useEventParticipants";

vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => context }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (...args: unknown[]) => { query(...args); return [{ items }]; } }));

const personId = parsePublicId<"User">("Participant00001");
const first = eventParticipantView.parseDto({
    publicId: "Membership000001", userId: personId, user: { publicId: personId, name: "Alice", cssClass: "performer" },
    bandUserInstruments: [{ publicId: "Assignment000001", isPrimary: true, bandInstrumentId: "Instrument000001", bandInstrument: { publicId: "Instrument000001" } }],
    bandUserTagAssignments: [{ publicId: "Assignment000002", bandUserTagId: "UserTag000000001", bandUserTag: { publicId: "UserTag000000001" } }],
});
const second = eventParticipantView.parseDto({
    publicId: "Membership000002", userId: personId, user: { publicId: personId, name: "Alice", cssClass: "performer" },
    bandUserInstruments: [], bandUserTagAssignments: [],
});
let context: DB3QueryContextInput;
let items = [first];
let participants: EventParticipant[];
const query = vi.fn();
let root: Root;
let container: HTMLDivElement;

function ParticipantProbe({ ids }: { readonly ids: readonly typeof personId[] }) {
    participants = useEventParticipants(ids);
    return <>{participants.map(participant => <span key={participant.membershipId}>{participant.membershipId}</span>)}</>;
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    query.mockClear();
    context = { bandPublicId: parsePublicId<"Band">("Band000000000001"), routeLocale: "fr-BE", browserLanguages: ["nl-BE"], clientRequestId: "first" };
    items = [first];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("event participant query adapter", () => {
    it("forwards presentation and person identities to the membership view without retaining previous data", async () => {
        await act(async () => root.render(<ParticipantProbe ids={[personId]} />));
        expect(query).toHaveBeenLastCalledWith(expect.anything(), {
            ...context,
            table: { tableID: "BandUser", tableName: "bandUser", viewID: "BandUser_EventParticipant" },
            filter: { tableParams: { personPublicIds: [personId] } }, cmdbQueryContext: "event participants",
        }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
        expect(participants[0]).toMatchObject({ publicId: personId, membershipId: first.publicId });
        expect(participants[0]?.bandUserInstruments).toHaveLength(1);
        expect(participants[0]?.bandUserTagAssignments).toHaveLength(1);

        context = { ...context, bandPublicId: parsePublicId<"Band">("Band000000000002"), routeLocale: "en-US", clientRequestId: "second" };
        items = [second];
        await act(async () => root.render(<ParticipantProbe ids={[personId]} />));
        expect(query.mock.calls.at(-1)?.[1]).toMatchObject(context);
        expect(participants[0]?.membershipId).toBe(second.publicId);
        expect(participants[0]?.bandUserInstruments).toEqual([]);
        expect(participants[0]?.bandUserTagAssignments).toEqual([]);
        expect(container.textContent).not.toContain(first.publicId);
    });

    it("retains an explicit empty filter and drops revoked rows and unreadable display data", async () => {
        items = [];
        await act(async () => root.render(<ParticipantProbe ids={[]} />));
        expect(query.mock.calls.at(-1)?.[1]).toMatchObject({ filter: { tableParams: { personPublicIds: [] } } });
        expect(participants).toEqual([]);
        expect(eventParticipantFromMembership(null)).toBeNull();
        const unreadable = eventParticipantView.parseDto({ ...first, user: { publicId: personId } });
        expect(eventParticipantFromMembership(unreadable)).toBeNull();
    });
});
