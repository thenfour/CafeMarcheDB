interface ReplaceSelectionWithTextOptions {
    select: "change" | "afterChange",
}

export interface ListAtCaretInfo {
    isList: boolean; // true if the caret is inside a list item
    prefix: string; // the prefix of the list item (e.g. "- ", "1. ", "[ ] ")
}

export interface ControlledTextAreaAPI {
    selectionStart: number;
    selectionEnd: number;
    scrollTop: number; // scrollTop is the vertical scroll position of the textarea

    getText: () => string;
    getListAtCaretInfo: () => ListAtCaretInfo;

    setSelectionRange: (start: number, end: number) => void;

    isLineBasedSelection: () => boolean;

    replaceRange: (start: number, end: number, replacement: string) => Promise<void>;
    replaceSelectionWithText: (replacement: string, options?: ReplaceSelectionWithTextOptions) => Promise<void>;
    surroundSelectionWithText: (prefix: string, suffix: string, textIfNoSelection: string) => Promise<void>;
    transformSelectedLines: (transform: (line: string, lineIndex: number, allSelectedLines: string[]) => string | undefined) => Promise<void>; // transforming a line to undefined removes it.
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

    const setSelectionRange = (start: number, end: number) => {
        if (!textArea) return;
        textArea.setSelectionRange(start, end);
        textArea.focus();
    };
    const setSelectionRangeAsync = (start: number, end: number): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                setSelectionRange(start, end);
                resolve();
            }, 0);
        });
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
        console.log(`selectedLineRange.lineCount: ${selectedLineRange.lineCount}`);
        return selectedLineRange.lineCount > 1;
    };

    // const getListAtCaretInfo = (): ListAtCaretInfo => {
    //     if (!textArea) return { isList: false, prefix: "" };
    //     const selectedLineRange = getLineRangeForCharRange(textValue, textArea.selectionStart, textArea.selectionEnd);
    //     const selectedLines = textValue.split('\n').slice(selectedLineRange.startLineIndex, selectedLineRange.startLineIndex + selectedLineRange.lineCount);
    //     const firstLine = selectedLines[0]!;
    //     // get the prefix of the list. could be any amount of indentation,
    //     // for ordered lists could be any number,
    //     // and checkbox lists could be [ ] or [x] or [X].
    //     const listPrefixRegex = /^( *)([\d]+\.|[-*]|[ ]?\[[ xX]?\] )/;
    //     const match = firstLine.match(listPrefixRegex);
    //     if (!match) return { isList: false, prefix: "" };
    //     const prefix = match[2] || ""; // the prefix is the 2nd group.
    //     const isList = match[0].length > 0; // if the prefix is empty, it's not a list.
    //     console.log(`prefix: '${prefix}'`);
    //     return { isList, prefix };
    // };

    /**
     * Attempts to detect if the caret is on a line that is recognized
     * as a Markdown list (unordered, ordered, or task list).
     * Returns the entire list prefix if it matches, otherwise { isList: false, prefix: "" }.
     */
    function getListAtCaretInfo(): ListAtCaretInfo {
        if (!textArea) {
            return { isList: false, prefix: "" };
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

        // A more robust pattern for Markdown list lines:
        // 1) Optional indentation: ^(\s*)
        // 2) Either (number + dot) or (bullet symbol)
        // 3) Optional [x]/[ ] for tasks, with optional spaces before it
        // 4) At least one space after
        const listPrefixRegex = /^(\s*(?:\d+\.|[+\-\*])(?:\s*\[[ xX]\])?\s+)/;

        // If it doesn't match, it's not recognized as a list
        const match = firstLine.match(listPrefixRegex);
        if (!match) {

            return { isList: false, prefix: "" };
        }

        // Group 1 is the entire matched prefix
        const prefix = match[1]!;
        return { isList: true, prefix };
    }

    return {
        selectionStart: textArea?.selectionStart ?? 0,
        selectionEnd: textArea?.selectionEnd ?? 0,
        setSelectionRange,
        getText: () => textValue,
        getListAtCaretInfo,
        scrollTop: textArea?.scrollTop ?? 0,
        transformSelectedLines,
        replaceRange,
        isLineBasedSelection,
        replaceSelectionWithText: async (replacement: string, options = { select: "afterChange" }) => {
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
        },
        surroundSelectionWithText: async (prefix: string, suffix: string, textIfNoSelection: string) => {
            const start = textArea?.selectionStart ?? 0;
            const end = textArea?.selectionEnd ?? 0;
            const selectedText = textValue.slice(start, end);

            if (end - start > 0) {
                // there's a selection; surround it.
                await replaceRange(start, end, prefix + selectedText + suffix);

                //const prefixStart = start;
                const existingTextStart = start + prefix.length;
                const suffixStart = existingTextStart + selectedText.length;
                //const suffixEnd = suffixStart + suffix.length;

                await setSelectionRangeAsync(existingTextStart, suffixStart);
                //await setSelectionRangeAsync(suffixEnd, suffixEnd);
            } else {
                // No selection, insert the default text highlighted
                await replaceRange(start, start, prefix + textIfNoSelection + suffix);

                //const prefixStart = start;
                const existingTextStart = start + prefix.length;
                const suffixStart = existingTextStart + textIfNoSelection.length;
                //const suffixEnd = suffixStart + suffix.length;

                await setSelectionRangeAsync(existingTextStart, suffixStart);
            }
        },
    };
}