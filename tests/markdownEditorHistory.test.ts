import { describe, expect, it } from "vitest";
import {
    classifyNativeMarkdownEdit,
    MarkdownEditorHistory,
    MarkdownEditorSnapshot,
} from "src/core/components/markdown/MarkdownEditorHistory";

function snapshot(text: string, selectionStart = text.length, selectionEnd = selectionStart): MarkdownEditorSnapshot {
    return { text, selectionStart, selectionEnd };
}

describe("MarkdownEditorHistory", () => {
    it("undoes to the seeded editor state and restores the selection", () => {
        const initial = snapshot("hello", 1, 4);
        const changed = snapshot("hello!", 6);
        const history = new MarkdownEditorHistory(initial);

        history.recordEdit({ before: initial, after: changed, editKind: "typing", timestampMs: 100 });

        expect(history.undo()).toEqual(initial);
        expect(history.redo()).toEqual(changed);
    });

    it("groups adjacent typing into one undo entry", () => {
        const empty = snapshot("");
        const first = snapshot("a");
        const second = snapshot("ab");
        const history = new MarkdownEditorHistory(empty);

        history.recordEdit({ before: empty, after: first, editKind: "typing", timestampMs: 100 });
        history.recordEdit({ before: first, after: second, editKind: "typing", timestampMs: 200 });

        expect(history.undo()).toEqual(empty);
        expect(history.canUndo).toBe(false);
    });

    it("starts a new entry after the caret moves", () => {
        const empty = snapshot("");
        const first = snapshot("a");
        const movedToStart = snapshot("a", 0);
        const second = snapshot("ba", 1);
        const history = new MarkdownEditorHistory(empty);

        history.recordEdit({ before: empty, after: first, editKind: "typing", timestampMs: 100 });
        history.recordEdit({ before: movedToStart, after: second, editKind: "typing", timestampMs: 200 });

        expect(history.undo()).toEqual(movedToStart);
        expect(history.undo()).toEqual(empty);
    });

    it("keeps commands and paste as isolated undo entries", () => {
        const initial = snapshot("text");
        const formatted = snapshot("**text**", 2, 6);
        const pasted = snapshot("**text** pasted");
        const history = new MarkdownEditorHistory(initial);

        history.recordEdit({ before: initial, after: formatted, editKind: "isolated", timestampMs: 100 });
        history.recordEdit({ before: formatted, after: pasted, editKind: "isolated", timestampMs: 110 });

        expect(history.undo()).toEqual(formatted);
        expect(history.undo()).toEqual(initial);
    });

    it("clears redo when a new edit follows undo", () => {
        const initial = snapshot("");
        const first = snapshot("a");
        const replacement = snapshot("b");
        const history = new MarkdownEditorHistory(initial);

        history.recordEdit({ before: initial, after: first, editKind: "typing", timestampMs: 100 });
        history.undo();
        history.recordEdit({ before: initial, after: replacement, editKind: "typing", timestampMs: 200 });

        expect(history.canRedo).toBe(false);
    });

    it("limits retained undo entries", () => {
        const initial = snapshot("");
        const first = snapshot("a");
        const second = snapshot("ab");
        const third = snapshot("abc");
        const history = new MarkdownEditorHistory(initial, { maxHistoryEntries: 2 });

        history.recordEdit({ before: initial, after: first, editKind: "isolated", timestampMs: 100 });
        history.recordEdit({ before: first, after: second, editKind: "isolated", timestampMs: 200 });
        history.recordEdit({ before: second, after: third, editKind: "isolated", timestampMs: 300 });

        expect(history.undo()).toEqual(second);
        expect(history.undo()).toEqual(first);
        expect(history.canUndo).toBe(false);
    });
});

describe("classifyNativeMarkdownEdit", () => {
    it("classifies typing, deletion, composition, and line breaks", () => {
        expect(classifyNativeMarkdownEdit("insertText", snapshot(""), snapshot("a"))).toBe("typing");
        expect(classifyNativeMarkdownEdit("deleteContentBackward", snapshot("a"), snapshot(""))).toBe("deleteBackward");
        expect(classifyNativeMarkdownEdit("insertCompositionText", snapshot(""), snapshot("a"))).toBe("composition");
        expect(classifyNativeMarkdownEdit("insertLineBreak", snapshot("a"), snapshot("a\n"))).toBe("isolated");
    });
});