// @vitest-environment jsdom
import React, { startTransition } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { PresentationProvider, usePresentation } from "src/locale/components/PresentationProvider";

vi.mock("@blitzjs/auth", () => ({ useSession: () => session }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (_query: unknown, input: PresentationInput) => pendingPresentation(input) }));
vi.mock("src/blitz-client", () => ({ queryClient: { invalidateQueries: vi.fn(async () => {}) } }));
vi.mock("src/locale/queries/getPresentationData", () => ({ default: vi.fn() }));

interface PendingRead {
    readonly input: PresentationInput;
    readonly promise: Promise<void>;
    readonly resolve: () => void;
    resolved: boolean;
}
const reads = new Map<string, PendingRead>();
let session = { userId: 11, permissionNames: ["login"] };
let container: HTMLDivElement;
let root: Root;

// Model a real suspending query cache: a new token starts a distinct pending read.
function pendingPresentation(input: PresentationInput) {
    const key = JSON.stringify(input);
    let read = reads.get(key);
    if (!read) {
        let finish = () => {};
        const promise = new Promise<void>(resolve => { finish = resolve; });
        const entry: PendingRead = { input, promise, resolved: false, resolve: () => { entry.resolved = true; finish(); } };
        reads.set(key, entry);
        read = entry;
    }
    if (!read.resolved) {
        throw read.promise;
    }
    return [{ input }];
}

function SelectedBand() {
    const presentation = usePresentation();
    return <span data-band={presentation.bandPublicId ?? "platform"}>{presentation.data?.input.clientRequestId}</span>;
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    reads.clear();
    session = { userId: 11, permissionNames: ["login"] };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function loadPlatform() {
    await act(async () => root.render(<PresentationProvider bandPublicId={null}><SelectedBand /></PresentationProvider>));
    await act(async () => { for (const read of reads.values()) { read.resolve(); } });
    expect(container.querySelector("[data-band]")?.getAttribute("data-band")).toBe("platform");
}

describe("presentation navigation through Suspense", () => {
    it("finishes a band transition using one stable request token across render retries", async () => {
        await loadPlatform();
        const before = reads.size;
        const band = parsePublicId<"Band">("NavigateBand0001");
        await act(async () => startTransition(() => root.render(
            <PresentationProvider bandPublicId={band}><SelectedBand /></PresentationProvider>,
        )));
        const pending = [...reads.values()].filter(read => read.input.bandPublicId === band);
        expect(pending).toHaveLength(1);
        await act(async () => pending[0]!.resolve());
        expect(container.querySelector("[data-band]")?.getAttribute("data-band")).toBe(band);
        expect(reads.size).toBe(before + 1);
    });

    it("uses a fresh snapshot after session grants change", async () => {
        await loadPlatform();
        const oldIds = new Set([...reads.values()].map(read => read.input.clientRequestId));
        session = { ...session, permissionNames: ["login", "search_users"] };
        await act(async () => root.render(<PresentationProvider bandPublicId={null}><SelectedBand /></PresentationProvider>));
        const pending = [...reads.values()].filter(read => !oldIds.has(read.input.clientRequestId));
        expect(pending).toHaveLength(1);
        await act(async () => pending[0]!.resolve());
        expect(container.querySelector("[data-band]")?.textContent).toBe(pending[0]!.input.clientRequestId);
    });
});
