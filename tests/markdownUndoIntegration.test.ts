// @vitest-environment jsdom
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    ControlledTextAreaAPI,
    useControlledTextArea,
} from "src/core/components/markdown/useControlledTextArea";

let root: Root;
let controlledTextArea: ControlledTextAreaAPI | undefined;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

function getControlledTextArea(): ControlledTextAreaAPI {
    if (!controlledTextArea) throw new Error("Controlled textarea has not rendered");
    return controlledTextArea;
}

function Harness({ initialValue }: { initialValue: string }) {
    const [value, setValue] = React.useState(initialValue);
    const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
    controlledTextArea = useControlledTextArea(textAreaRef, value, setValue);
    return React.createElement("textarea", { ref: textAreaRef, value, readOnly: true });
}

async function renderEditor(initialValue: string): Promise<HTMLTextAreaElement> {
    await act(async () => {
        root.render(React.createElement(Harness, { initialValue }));
    });
    return document.querySelector("textarea")!;
}

async function invokeEditorCommand(command: () => Promise<void>): Promise<void> {
    let commandPromise: Promise<void> | undefined;
    act(() => {
        commandPromise = command();
    });
    await act(async () => {
        await commandPromise;
    });
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
    controlledTextArea = undefined;
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) {
        Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    } else {
        Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
});

describe("markdown undo integration", () => {
    it("undoes and redoes a programmatic formatting edit with its selection", async () => {
        const textarea = await renderEditor("text");
        textarea.setSelectionRange(0, 4);

        await invokeEditorCommand(() =>
            getControlledTextArea().surroundSelectionWithText("**", "**", "bold text")
        );

        expect(textarea.value).toBe("**text**");
        expect(textarea.selectionStart).toBe(2);
        expect(textarea.selectionEnd).toBe(6);
        expect(getControlledTextArea().undoManagerApi.canUndo).toBe(true);

        await invokeEditorCommand(() => getControlledTextArea().undoManagerApi.undo());

        expect(textarea.value).toBe("text");
        expect(textarea.selectionStart).toBe(0);
        expect(textarea.selectionEnd).toBe(4);
        expect(getControlledTextArea().undoManagerApi.canRedo).toBe(true);

        await invokeEditorCommand(() => getControlledTextArea().undoManagerApi.redo());

        expect(textarea.value).toBe("**text**");
        expect(textarea.selectionStart).toBe(2);
        expect(textarea.selectionEnd).toBe(6);
    });

    it("groups adjacent native typing into one undo entry", async () => {
        const textarea = await renderEditor("");

        await act(async () => {
            const editor = getControlledTextArea();
            editor.handleNativeBeforeInput("insertText", 0, 0);
            editor.handleNativeTextChange({
                text: "a",
                selectionStart: 1,
                selectionEnd: 1,
                inputType: "insertText",
            });
        });
        await act(async () => {
            const editor = getControlledTextArea();
            editor.handleNativeBeforeInput("insertText", 1, 1);
            editor.handleNativeTextChange({
                text: "ab",
                selectionStart: 2,
                selectionEnd: 2,
                inputType: "insertText",
            });
        });

        expect(textarea.value).toBe("ab");
        await invokeEditorCommand(() => getControlledTextArea().undoManagerApi.undo());
        expect(textarea.value).toBe("");
        expect(getControlledTextArea().undoManagerApi.canUndo).toBe(false);
    });
});