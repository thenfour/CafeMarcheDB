interface ReplaceSelectionWithTextOptions {
    select: "change" | "afterChange",
}

export interface ListAtCaretInfo {
    isListItem: boolean; // true if the caret is inside a list item
    prefix: string; // the prefix of the list item (e.g. "- ", "1. ", "[ ] ")
    itemText: string; // the text of the list item (e.g. "Item 1")
}

export interface ControlledTextAreaAPI {
    selectionStart: number;
    selectionEnd: number;
    scrollTop: number; // scrollTop is the vertical scroll position of the textarea

    getSelectedText: () => string;
    getText: () => string;
    getListAtCaretInfo: () => ListAtCaretInfo;

    setSelectionRange: (start: number, end: number) => Promise<void>;

    isLineBasedSelection: () => boolean;

    replaceRange: (start: number, end: number, replacement: string) => Promise<void>;
    replaceSelectionWithText: (replacement: string, options?: ReplaceSelectionWithTextOptions) => Promise<void>;
    surroundSelectionWithText: (prefix: string, suffix: string, textIfNoSelection: string) => Promise<void>;
    transformSelectedLines: (transform: (line: string, lineIndex: number, allSelectedLines: string[]) => string | undefined) => Promise<void>; // transforming a line to undefined removes it.
    toggleSurroundingSelectionWithText: (prefix: string, suffix: string, textIfNoSelection: string) => Promise<void>;
}

function getLineCount(text: string): number {
    return text.split('\n').length;
}

function getCharIndexAtLineStart(text: string, lineIndex: number): number {
    if (lineIndex <= 0) return 0;
    if (lineIndex >= (text.split('\n').length)) return text.length;

    let idx = 0;
    let currentLine = 0;
    while (currentLine < lineIndex && idx < text.length) {
        if (text[idx] === '\n') {
            currentLine++;
            // The next char after \n is the start of the next line
            if (currentLine === lineIndex) {
                idx++; // skip the newline
                break;
            }
        }
        idx++;
    }
    return idx;
}

// returns the range of lines that are selected in the given text, based on the given character range.
function getLineRangeForCharRange(text: string, selectionStart: number, selectionEnd: number): { startLineIndex: number; lineCount: number } {
    const textBeforeSelection = text.slice(0, selectionStart);
    const safeSelectionEnd = Math.max(selectionStart, selectionEnd - 1); // avoid counting a line if the selection ends right at the beginning of it (common)
    const selection = text.slice(selectionStart, safeSelectionEnd);
    const lineCount = selection.split('\n').length;
    const startLineIndex = textBeforeSelection.split('\n').length - 1; // a single line has no newline. that is index 0.
    return {
        startLineIndex,
        lineCount,
    }
};



export function useControlledTextArea(
    textArea: HTMLTextAreaElement | undefined | null,
    textValue: string,
    onTextChange: (val: string) => void
): ControlledTextAreaAPI {

    const setSelectionRange = async (start: number, end: number) => {
        return new Promise<void>((resolve) => {
            if (!textArea) return resolve();
            textArea.setSelectionRange(start, end);
            textArea.focus();
            setTimeout(() => {
                resolve();
            }, 0); // wait for the focus to be applied before resolving.
        });
        // if (!textArea) return;
        // textArea.setSelectionRange(start, end);
        // textArea.focus();
    };
    const setSelectionRangeAsync = (start: number, end: number): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(async () => {
                await setSelectionRange(start, end);
                resolve();
            }, 0);
        });
    };

    const getSelectedText = () => {
        if (!textArea) return "";
        return textValue.slice(textArea.selectionStart, textArea.selectionEnd);
    };

    const replaceRange = async (start: number, end: number, replacement: string) => {
        const before = textValue.slice(0, start);
        const after = textValue.slice(end);
        const newText = before + replacement + after;
        onTextChange(newText);
    };

    async function transformSelectedLines(
        transformLine: (text: string, lineIndex: number, allSelectedLines: string[]) => string | undefined
    ) {
        if (!textArea) return;

        const isLineBasedSelection = textArea.selectionEnd - textArea.selectionStart > 0; // if you have a selected range, consider it line based.
        const selectedLineRange = getLineRangeForCharRange(textValue, textArea.selectionStart, textArea.selectionEnd);

        // split into lines.
        const lines = textValue.split('\n');

        // store lines before & after selected lines.
        const beforeLines = lines.slice(0, selectedLineRange.startLineIndex);
        const selectedLines = lines.slice(selectedLineRange.startLineIndex, selectedLineRange.startLineIndex + selectedLineRange.lineCount);
        const afterLines = lines.slice(selectedLineRange.startLineIndex + selectedLineRange.lineCount);

        // transform selected lines. in the case the plugin increases the number of lines, we need to
        // add it to the selection later.
        let lineCountDelta = 0;
        const transformedLines = selectedLines.map((line, index) => {
            const newLine = transformLine(line, index, selectedLines);
            if (newLine === undefined) {
                // undefined means remove the line.
                lineCountDelta--;
                return undefined;
            }
            const newLineCount = getLineCount(newLine);
            if (newLineCount > 1) {
                // if the new line is longer than 1, we need to add it to the selection.
                lineCountDelta += newLineCount - 1;
            }
            return newLine;
        });

        // reassemble text.
        const newText = [
            ...beforeLines,
            ...transformedLines.filter(line => line !== undefined), // remove deleted lines
            ...afterLines
        ].join('\n');

        // determine the new selection range. start at the start of the first selected line,
        // and end at the end of the last selected line.
        const newSelectionStart = getCharIndexAtLineStart(newText, selectedLineRange.startLineIndex);
        const newSelectionEnd = getCharIndexAtLineStart(newText, selectedLineRange.startLineIndex + selectedLineRange.lineCount + lineCountDelta);

        onTextChange(newText);

        if (isLineBasedSelection) {
            await setSelectionRangeAsync(newSelectionStart, newSelectionEnd);
        } else {
            // if the selection is not line based, just set a caret at the end of the transformed area.
            await setSelectionRangeAsync(newSelectionEnd, newSelectionEnd);
        }
    }

    const isLineBasedSelection = () => {
        if (!textArea) return false;
        const selectedLineRange = getLineRangeForCharRange(textValue, textArea.selectionStart, textArea.selectionEnd);
        return selectedLineRange.lineCount > 1;
    };

    /**
     * Attempts to detect if the caret is on a line that is recognized
     * as a Markdown list (unordered, ordered, or task list).
     * Returns the entire list prefix if it matches, otherwise { isList: false, prefix: "" }.
     */
    function getListAtCaretInfo(): ListAtCaretInfo {
        if (!textArea) {
            return { isListItem: false, prefix: "", itemText: "" };
        }

        // Get the relevant line(s) where the selection starts
        const selectedLineRange = getLineRangeForCharRange(
            textValue,
            textArea.selectionStart,
            textArea.selectionEnd
        );
        const selectedLines = textValue
            .split("\n")
            .slice(
                selectedLineRange.startLineIndex,
                selectedLineRange.startLineIndex + selectedLineRange.lineCount
            );

        // We'll just inspect the first line for determining list prefix
        const firstLine = selectedLines[0] || "";

        // we need to extract the prefix and the item text.
        // The prefix is the part that matches the list item regex.
        // The item text is the rest of the line after the prefix.

        // // - Optional indentation: ^(\s*)
        // // - Either (number + dot) or (bullet symbol)
        // // - Optional [x]/[ ] for tasks, with optional spaces before it
        // // - At least one space after
        const listPrefixRegex = /^(\s*(?:\d+\.|[+\-\*])(?:\s*\[[ xX]\])?\s+)/;

        // If it doesn't match, it's not recognized as a list
        const match = firstLine.match(listPrefixRegex);
        if (!match) {
            return { isListItem: false, prefix: "", itemText: "" };
        }

        // Extract the prefix and item text
        const prefix = match[1] || ""; // The prefix is the entire matched prefix
        const itemText = firstLine.slice(prefix.length).trim(); // The rest of the line is the item text

        return { isListItem: true, prefix, itemText };

        // // Group 1 is the entire matched prefix
        // const prefix = match[1]!;
        // return { isListItem: true, prefix };
    }

    const surroundSelectionWithText = async (prefix: string, suffix: string, textIfNoSelection: string) => {
        const start = textArea?.selectionStart ?? 0;
        const end = textArea?.selectionEnd ?? 0;
        const selectedText = textValue.slice(start, end);

        if (end - start > 0) {
            // there's a selection; surround it.
            await replaceRange(start, end, prefix + selectedText + suffix);
            const existingTextStart = start + prefix.length;
            const suffixStart = existingTextStart + selectedText.length;
            await setSelectionRangeAsync(existingTextStart, suffixStart);
        } else {
            // No selection, insert the default text highlighted
            await replaceRange(start, start, prefix + textIfNoSelection + suffix);
            const existingTextStart = start + prefix.length;
            const suffixStart = existingTextStart + textIfNoSelection.length;
            await setSelectionRangeAsync(existingTextStart, suffixStart);
        }
    };

    const replaceSelectionWithText = async (replacement: string, options = { select: "afterChange" }) => {
        const start = textArea?.selectionStart ?? 0;
        const end = textArea?.selectionEnd ?? 0;
        await replaceRange(start, end, replacement);

        // respect the select option
        if (options.select === "change") {
            await setSelectionRangeAsync(start, start + replacement.length);
        }
        else if (options.select === "afterChange") {
            await setSelectionRangeAsync(start + replacement.length, start + replacement.length);
        }
    };


    return {
        selectionStart: textArea?.selectionStart ?? 0,
        selectionEnd: textArea?.selectionEnd ?? 0,
        setSelectionRange,
        getText: () => textValue,
        getSelectedText,
        getListAtCaretInfo,
        scrollTop: textArea?.scrollTop ?? 0,
        transformSelectedLines,
        replaceRange,
        isLineBasedSelection,
        surroundSelectionWithText,
        replaceSelectionWithText,
        // if the selection is surrounded by or includes the prefix and suffix, remove them
        // if not, add them.
        // if there's no selection, add the prefix and suffix around the textIfNoSelection.
        toggleSurroundingSelectionWithText: async (prefix: string, suffix: string, textIfNoSelection: string) => {
            const selectedText = getSelectedText();
            // if the selection includes the surrounding ** (exactly 2 asterisks), remove them.
            // this is the case when the selection INCLUDES the asterisks.
            if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
                const newText = selectedText.slice(prefix.length, -suffix.length);
                await replaceSelectionWithText(newText, { select: "change" });
                return;
            }

            const selectionStart = textArea?.selectionStart ?? 0;
            const selectionEnd = textArea?.selectionEnd ?? 0;

            // if the selection is not surrounded by **, but the text includes them, same thing.
            const selectedTextWithSurrounding = textValue.slice(selectionStart - prefix.length, selectionEnd + suffix.length);
            if (selectedTextWithSurrounding.startsWith(prefix) && selectedTextWithSurrounding.endsWith(suffix)) {
                const newText = selectedTextWithSurrounding.slice(prefix.length, -suffix.length);
                await setSelectionRange(selectionStart - prefix.length, selectionEnd + suffix.length);
                await replaceSelectionWithText(newText, { select: "change" });
                return;
            }

            return await surroundSelectionWithText(prefix, suffix, textIfNoSelection);
        }
    };
}