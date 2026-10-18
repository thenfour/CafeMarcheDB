// @vitest-environment jsdom

import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import superjson from "superjson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerStartState, serializeServerStartInfo, type ServerStartInfo, type ServerStartInfoDto } from "shared/serverStateBase";
import { DateValue } from "src/core/components/DateTime/DateTimeComponents";
import { ServerStartupStateProvider, useServerStartupState } from "src/core/components/ServerStartupStateContext";

const serverInfo: ServerStartInfo = {
    baseUri: "https://band.example.test",
    startedAt: new Date("2026-10-18T10:00:00.123Z"),
    uptimeMS: 1234,
    gitRevision: "test-revision",
    gitCommitDate: new Date("2026-10-17T12:30:00.456Z"),
    versionTag: "3.0.1",
    versionCommitsSinceTag: 2,
    versionIsDirty: false,
};

let root: Root;
let container: HTMLDivElement;
let observedInfo: ServerStartInfo | null;

function CaptureStartupState() {
    observedInfo = useServerStartupState();
    return observedInfo ? <>
        <DateValue value={observedInfo.startedAt} formattingLocale="en-GB" timeZone="UTC" />
        <DateValue value={observedInfo.gitCommitDate} formattingLocale="en-GB" timeZone="UTC" />
    </> : <span>No diagnostics</span>;
}

async function renderStartupState(value: ServerStartInfoDto | null) {
    await act(async () => {
        root.render(<ServerStartupStateProvider value={value}><CaptureStartupState /></ServerStartupStateProvider>);
    });
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    observedInfo = null;
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("startup-state transport boundary", () => {
    it("keeps the server getter's dates as Date instances", () => {
        vi.stubEnv("CMDB_START_TIME", String(serverInfo.startedAt.valueOf()));
        vi.stubEnv("CMDB_GIT_COMMIT_DATE", serverInfo.gitCommitDate.toISOString());
        const info = getServerStartState();
        expect(info.startedAt).toEqual(serverInfo.startedAt);
        expect(info.gitCommitDate).toEqual(serverInfo.gitCommitDate);
        expect(info.startedAt).toBeInstanceOf(Date);
        expect(info.gitCommitDate).toBeInstanceOf(Date);
    });

    it.each(["direct", "JSON page props", "Blitz RPC"])("restores both dates before DateValue renders after %s transport", async transport => {
        let dto = serializeServerStartInfo(serverInfo);
        expect(dto.startedAt).toBe("2026-10-18T10:00:00.123Z");
        expect(dto.gitCommitDate).toBe("2026-10-17T12:30:00.456Z");
        if (transport === "JSON page props") {
            // JSON parses the known DTO fixture without a runtime schema.
            dto = JSON.parse(JSON.stringify(dto)) as ServerStartInfoDto;
        } else if (transport === "Blitz RPC") {
            dto = superjson.parse<ServerStartInfoDto>(superjson.stringify(dto));
        }

        await renderStartupState(dto);

        expect(observedInfo).toEqual(serverInfo);
        expect(observedInfo?.startedAt).toBeInstanceOf(Date);
        expect(observedInfo?.gitCommitDate).toBeInstanceOf(Date);
        expect(container.querySelectorAll(".DateValue")).toHaveLength(2);
    });

    it("restores dates during server rendering too", () => {
        function CaptureServerStartupState() {
            observedInfo = useServerStartupState();
            return null;
        }
        renderToString(<ServerStartupStateProvider value={serializeServerStartInfo(serverInfo)}>
            <CaptureServerStartupState />
        </ServerStartupStateProvider>);
        expect(observedInfo).toEqual(serverInfo);
        expect(observedInfo?.startedAt).toBeInstanceOf(Date);
        expect(observedInfo?.gitCommitDate).toBeInstanceOf(Date);
    });

    it("keeps non-Sysadmin diagnostics null and replaces state on navigation", async () => {
        await renderStartupState(null);
        expect(observedInfo).toBeNull();
        expect(container.textContent).toBe("No diagnostics");

        await renderStartupState(serializeServerStartInfo(serverInfo));
        expect(observedInfo).toEqual(serverInfo);

        const restartedInfo = { ...serverInfo, startedAt: new Date("2026-10-18T11:00:00.000Z"), uptimeMS: 10 };
        await renderStartupState(serializeServerStartInfo(restartedInfo));
        expect(observedInfo).toEqual(restartedInfo);

        await renderStartupState(null);
        expect(observedInfo).toBeNull();
        expect(container.querySelectorAll(".DateValue")).toHaveLength(0);
    });
});
