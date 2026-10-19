// @vitest-environment jsdom
import { describePermissionRequirement } from "src/auth/shared/permissionRequirement";
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageRouteProvider, usePageRoute } from "src/route/usePageRoute";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

function RouteDetails() {
    const route = usePageRoute();
    return <span>{route.key}:{describePermissionRequirement(route.permission)}:{route.theming}</span>;
}

describe("current page route", () => {
    it("updates route metadata for navigation without reading Next's pathname", () => {
        act(() => root.render(<PageRouteProvider routeKey="bandEvent"><RouteDetails /></PageRouteProvider>));
        expect(container.textContent).toBe('bandEvent:{"anyOf":["view_events_nonpublic","global_band_admin"],"requiresBand":true}:band');

        act(() => root.render(<PageRouteProvider routeKey="adminLogs"><RouteDetails /></PageRouteProvider>));
        expect(container.textContent).toBe('adminLogs:"sysadmin":platform');
    });
});
