interface ReplaceSelectionWithTextOptions {
    select: "change" | "afterChange",
}

export interface ControlledTextAreaAPI {
    selectionStart: number;
    selectionEnd: number;
    scrollTop: number; // scrollTop is the vertical scroll position of the textarea

    getText: () => string;

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

        await setSelectionRangeAsync(newSelectionStart, newSelectionEnd);
    }

    const isLineBasedSelection = () => {
        if (!textArea) return false;
        const selectedLineRange = getLineRangeForCharRange(textValue, textArea.selectionStart, textArea.selectionEnd);
        console.log(`selectedLineRange.lineCount: ${selectedLineRange.lineCount}`);
        return selectedLineRange.lineCount > 1;
    };

    return {
        selectionStart: textArea?.selectionStart ?? 0,
        selectionEnd: textArea?.selectionEnd ?? 0,
        setSelectionRange,
        getText: () => textValue,
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