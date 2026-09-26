// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EventPublicId } from "shared/publicId";

const { dashboard, query } = vi.hoisted(() => {
    const dashboard: { relevantEventIds: EventPublicId[] } = { relevantEventIds: [] };
    return { dashboard, query: vi.fn(() => ({ items: [] })) };
});
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => dashboard }));
vi.mock("src/core/db3/DB3Client", () => ({ useDb3Query: query }));
vi.mock("src/core/components/AppContext", () => ({ AppContextMarker: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: () => null }));
vi.mock("src/core/components/SearchItemBigCardLink", () => ({ SearchItemBigCardLink: () => null }));
vi.mock("src/core/components/event/EventChips", () => ({ EventStatusMinimal: () => null }));
vi.mock("src/core/components/event/EventComponents", () => ({ EventListItem: () => null, gEventDetailTabSlugIndices: {} }));
vi.mock("src/core/components/event/EventRelevanceOverrideComponents", () => ({ RelevanceClassOverrideIndicator: () => null }));
vi.mock("src/core/components/event/EventShortDate", () => ({ EventShortDate: () => null }));

import { RelevantEvents } from "src/core/components/event/RelevantEvents";
import { eventSearchView, xEvent } from "src/core/db3/db3";

let root: Root;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    query.mockClear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

it.each([{ ids: [] }, { ids: [xEvent.parseIdentity("RelevantEvent001")] }])("fetches dashboard identities using publicIds, including empty lists: %j", async ({ ids }) => {
    dashboard.relevantEventIds = ids;
    await act(async () => root.render(React.createElement(RelevantEvents)));
    expect(query).toHaveBeenCalledWith({ view: eventSearchView, filterSpec: { publicIds: ids } });
});
