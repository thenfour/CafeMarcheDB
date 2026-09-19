// @vitest-environment jsdom

import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mui/material", async () => {
    const ReactModule = await vi.importActual<typeof import("react")>("react");
    const Box = ReactModule.forwardRef(({ component = "div", children, sx: _sx, ...props }: any, ref) =>
        ReactModule.createElement(component, { ...props, ref }, children));
    return {
        Box,
        CircularProgress: () => ReactModule.createElement("span", { className: "spinner" }),
        Tooltip: ({ children }: React.PropsWithChildren) => ReactModule.createElement(ReactModule.Fragment, null, children),
        Typography: ({ children }: React.PropsWithChildren) => ReactModule.createElement("div", null, children),
    };
});

vi.mock("@mui/icons-material/PowerOff", async () => {
    const ReactModule = await vi.importActual<typeof import("react")>("react");
    return { default: () => ReactModule.createElement("svg", { "data-testid": "power-off" }) };
});
import {
    ConnectionStatusIndicator,
    DashboardLoadingStatus,
} from "src/core/connectivity/ConnectionHealthComponents";
import {
    reportConnectivityFailure,
    reportConnectivitySuccess,
    resetConnectionHealth,
} from "src/core/connectivity/connectionHealth";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
    await act(async () => root.unmount());
    resetConnectionHealth();
    container.remove();
});

describe("connection status presentation", () => {
    it("shows the unplugged status beside cached content until a request succeeds", async () => {
        const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
        await act(async () => {
            root.render(React.createElement(ConnectionStatusIndicator));
        });
        expect(container.querySelector(".connectionStatusIndicator")).toBeNull();

        await act(async () => {
            reportConnectivityFailure(new TypeError("NetworkError when attempting to fetch resource."), {
                source: "query",
                operation: "/api/rpc/getEvent",
                hasCachedData: true,
            });
        });

        const indicator = container.querySelector(".connectionStatusIndicator");
        expect(indicator).not.toBeNull();
        expect(indicator?.getAttribute("aria-label")).toContain("server cannot be reached");
        expect(indicator?.querySelector("svg")).not.toBeNull();

        await act(async () => {
            reportConnectivitySuccess("/api/rpc/getDashboardData");
        });
        expect(container.querySelector(".connectionStatusIndicator")).toBeNull();

        warning.mockRestore();
        info.mockRestore();
    });

    it("replaces an indefinite initial spinner with an offline explanation", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        await act(async () => {
            reportConnectivityFailure(new TypeError("Failed to fetch"), {
                source: "query",
                operation: "/api/rpc/getDashboardData",
                hasCachedData: false,
            });
            root.render(React.createElement(DashboardLoadingStatus));
        });

        expect(container.textContent).toContain("Waiting for a connection");
        expect(container.textContent).toContain("continue automatically");
    });
});
