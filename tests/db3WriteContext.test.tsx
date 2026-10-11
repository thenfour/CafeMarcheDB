// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { useDB3Command, type DB3CommandContextInput } from "src/core/db3/components/useDB3Command";
import { globalRoleEditorView } from "src/core/db3/shared/entities/user/roleViews";

vi.mock("src/core/db3/mutations/executeDB3Command", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useMutation: () => [mutate] }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({
    bandPublicId: selectedBand, routeLocale: "fr-BE", browserLanguages: ["nl-BE"],
}) }));

const selectedBand = parsePublicId<"Band">("SelectedBand0001");
const identity = parsePublicId<"GlobalRole">("GlobalRole000001");
const mutate = vi.fn(async (_request: unknown) => ({ identity }));
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

function Editor({ writeContext }: { writeContext?: DB3CommandContextInput }) {
    const command = useDB3Command(globalRoleEditorView.crud.operations.update.command, writeContext);
    return <button onClick={() => { void command.invoke({ identity, patch: { sortOrder: 12 } }); }}>Save</button>;
}

describe("DB3 caller-owned write context", () => {
    it.each([
        { description: "presentation scope", writeContext: undefined, expectedBand: selectedBand },
        { description: "explicit platform authority", writeContext: { bandPublicId: null }, expectedBand: null },
        { description: "explicit band authority", writeContext: { bandPublicId: selectedBand }, expectedBand: selectedBand },
    ])("uses $description without changing the prepared command payload", async ({ writeContext, expectedBand }) => {
        await act(async () => root.render(<Editor writeContext={writeContext} />));
        await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
        expect(mutate).toHaveBeenCalledWith({ commandID: "GlobalRole_Update", bandPublicId: expectedBand,
            payload: { identity, patch: { sortOrder: 12 } } });
    });
});
