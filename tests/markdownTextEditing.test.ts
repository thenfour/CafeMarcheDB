import { describe, expect, it } from "vitest";
import { getListAtCaretInfo, isLineBasedSelection, transformSelectedLines } from "src/core/components/markdown/MarkdownTextEditing";

describe("markdown line transformations", () => {
    it("keeps a collapsed caret on its line when indentation is added", () => {
        const result = transformSelectedLines("- \nadditional content", 2, 2, line => `  ${line}`);

        expect(result).toEqual({
            text: "  - \nadditional content",
            selectionStart: 4,
            selectionEnd: 4,
        });
    });

    it("maps a collapsed caret through removed indentation", () => {
        const result = transformSelectedLines("  - an item\nnext", 6, 6, line => line.slice(2));

        expect(result).toEqual({
            text: "- an item\nnext",
            selectionStart: 4,
            selectionEnd: 4,
        });
    });

    it("preserves the existing whole-line selection behavior for selected text", () => {
        const result = transformSelectedLines("first\nsecond\nthird", 2, 10, line => `> ${line}`);

        expect(result).toEqual({
            text: "> first\n> second\nthird",
            selectionStart: 0,
            selectionEnd: 17,
        });
    });

    it("only treats selections that include content from multiple lines as line based", () => {
        expect(isLineBasedSelection("first\nsecond", 1, 4)).toBe(false);
        expect(isLineBasedSelection("first\nsecond", 1, 6)).toBe(false);
        expect(isLineBasedSelection("first\nsecond", 1, 7)).toBe(true);
    });
});

describe("markdown list context at the caret", () => {
    it("does not recognize a list when the caret is before or inside its prefix", () => {
        expect(getListAtCaretInfo("- an item", 0).isListItem).toBe(false);
        expect(getListAtCaretInfo("- an item", 1).isListItem).toBe(false);
        expect(getListAtCaretInfo("  - an item", 3).isListItem).toBe(false);
        expect(getListAtCaretInfo("\n- an item", 0).isListItem).toBe(false);
    });

    it("recognizes list context once the caret is after the complete prefix", () => {
        expect(getListAtCaretInfo("- an item", 2)).toEqual({
            isListItem: true,
            prefix: "- ",
            itemText: "an item",
        });
        expect(getListAtCaretInfo("before\n  12. [x] an item", 19)).toEqual({
            isListItem: true,
            prefix: "  12. [x] ",
            itemText: "an item",
        });
    });

    it("keeps empty list items recognizable so Enter can end the list", () => {
        expect(getListAtCaretInfo("- ", 2)).toEqual({
            isListItem: true,
            prefix: "- ",
            itemText: "",
        });
    });
});