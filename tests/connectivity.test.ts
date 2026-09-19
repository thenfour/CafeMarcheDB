import { afterEach, describe, expect, it, vi } from "vitest";
import {
    getConnectionHealthSnapshot,
    isConnectivityError,
    reportConnectivityFailure,
    reportConnectivitySuccess,
    resetConnectionHealth,
    shouldRetryQuery,
    shouldThrowQueryError,
} from "src/core/connectivity/connectionHealth";

afterEach(() => {
    resetConnectionHealth();
});

describe("connectivity error policy", () => {
    it.each([
        "NetworkError when attempting to fetch resource.",
        "Failed to fetch",
        "Load failed",
        "Network request failed",
        "fetch failed",
    ])("recognizes browser transport failure %s", message => {
        expect(isConnectivityError(new TypeError(message))).toBe(true);
    });

    it("does not mistake aborts, HTTP responses, or application failures for connectivity", () => {
        expect(isConnectivityError(Object.assign(new Error("Load failed"), { name: "AbortError" }))).toBe(false);
        expect(isConnectivityError(Object.assign(new Error("Network request failed"), { statusCode: 503 }))).toBe(false);
        expect(isConnectivityError(new Error("Invalid event data"))).toBe(false);
    });

    it("retries connectivity failures briefly and does not retry application failures", () => {
        const networkError = new TypeError("Failed to fetch");
        expect(shouldRetryQuery(0, networkError)).toBe(true);
        expect(shouldRetryQuery(1, networkError)).toBe(true);
        expect(shouldRetryQuery(2, networkError)).toBe(false);
        expect(shouldRetryQuery(0, new Error("Invalid event data"))).toBe(false);
    });

    it("keeps cached data visible but delegates an uncached connectivity failure to the boundary", () => {
        const networkError = new TypeError("NetworkError when attempting to fetch resource.");
        expect(shouldThrowQueryError(networkError, {
            state: { data: { setlist: "still visible" } },
        })).toBe(false);
        expect(shouldThrowQueryError(networkError, {
            state: { data: undefined },
        })).toBe(true);
    });

    it("still throws application errors even when a query has cached data", () => {
        const applicationError = new Error("Invalid event data");
        expect(shouldThrowQueryError(applicationError, {
            state: { data: { event: 1 } },
        })).toBe(true);
    });
});

describe("connection health diagnostics", () => {
    it("records a query failure and clears it only after a successful request", () => {
        const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

        reportConnectivityFailure(new TypeError("Failed to fetch"), {
            source: "query",
            operation: "/api/rpc/getEvent",
            hasCachedData: true,
            failureCount: 2,
        });

        expect(getConnectionHealthSnapshot().issue?.reason).toBe("server-unreachable");
        expect(warning).toHaveBeenCalledWith(
            expect.stringContaining("cached data"),
            expect.objectContaining({
                source: "query",
                operation: "/api/rpc/getEvent",
                hasCachedData: true,
            }),
        );

        reportConnectivitySuccess("dashboard-data");
        expect(getConnectionHealthSnapshot().issue).toBeNull();
        expect(info).toHaveBeenCalledWith(
            expect.stringContaining("restored"),
            expect.objectContaining({ operation: "dashboard-data" }),
        );
    });
});
