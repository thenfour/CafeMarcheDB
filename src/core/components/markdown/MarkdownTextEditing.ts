export interface TextEditResult {
    text: string;
    selectionStart: number;
    selectionEnd: number;
}

export interface ListAtCaretInfo {
    isListItem: boolean;
    prefix: string;
    itemText: string;
}

export type SelectedLineTransform = (
    line: string,
    lineIndex: number,
    allSelectedLines: string[]
) => string | undefined;

function getLineCount(text: string): number {
    return text.split("\n").length;
}

function getCharIndexAtLineStart(text: string, lineIndex: number): number {
    if (lineIndex <= 0) return 0;

    const lines = text.split("\n");
    if (lineIndex >= lines.length) return text.length;

    let charIndex = 0;
    for (let currentLineIndex = 0; currentLineIndex < lineIndex; currentLineIndex++) {
        charIndex += lines[currentLineIndex]!.length + 1;
    }
    return charIndex;
}

function getLineRangeForCharRange(text: string, selectionStart: number, selectionEnd: number): { startLineIndex: number; lineCount: number } {
    const textBeforeSelection = text.slice(0, selectionStart);
    const safeSelectionEnd = Math.max(selectionStart, selectionEnd - 1);
    const selection = text.slice(selectionStart, safeSelectionEnd);
    return {
        startLineIndex: textBeforeSelection.split("\n").length - 1,
        lineCount: selection.split("\n").length,
    };
}

export function isLineBasedSelection(text: string, selectionStart: number, selectionEnd: number): boolean {
    return getLineRangeForCharRange(text, selectionStart, selectionEnd).lineCount > 1;
}

function mapPositionThroughLineTransform(originalLine: string, transformedLine: string, originalPosition: number): number {
    if (originalLine === transformedLine) return originalPosition;

    let commonPrefixLength = 0;
    while (
        commonPrefixLength < originalLine.length &&
        commonPrefixLength < transformedLine.length &&
        originalLine[commonPrefixLength] === transformedLine[commonPrefixLength]
    ) {
        commonPrefixLength++;
    }

    let commonSuffixLength = 0;
    while (
        commonSuffixLength < originalLine.length - commonPrefixLength &&
        commonSuffixLength < transformedLine.length - commonPrefixLength &&
        originalLine[originalLine.length - commonSuffixLength - 1] === transformedLine[transformedLine.length - commonSuffixLength - 1]
    ) {
        commonSuffixLength++;
    }

    const originalChangeEnd = originalLine.length - commonSuffixLength;
    const transformedChangeEnd = transformedLine.length - commonSuffixLength;
    if (originalPosition < commonPrefixLength) return originalPosition;
    if (originalPosition > originalChangeEnd) {
        return originalPosition + transformedLine.length - originalLine.length;
    }
    return transformedChangeEnd;
}

export function transformSelectedLines(
    text: string,
    selectionStart: number,
    selectionEnd: number,
    transformLine: SelectedLineTransform
): TextEditResult {
    const hasSelection = selectionEnd > selectionStart;
    const selectedLineRange = getLineRangeForCharRange(text, selectionStart, selectionEnd);
    const lines = text.split("\n");
    const beforeLines = lines.slice(0, selectedLineRange.startLineIndex);
    const selectedLines = lines.slice(selectedLineRange.startLineIndex, selectedLineRange.startLineIndex + selectedLineRange.lineCount);
    const afterLines = lines.slice(selectedLineRange.startLineIndex + selectedLineRange.lineCount);

    let lineCountDelta = 0;
    const transformedLines = selectedLines.map((line, lineIndex) => {
        const transformedLine = transformLine(line, lineIndex, selectedLines);
        if (transformedLine === undefined) {
            lineCountDelta--;
            return undefined;
        }
        lineCountDelta += getLineCount(transformedLine) - 1;
        return transformedLine;
    });

    const transformedText = [
        ...beforeLines,
        ...transformedLines.filter((line): line is string => line !== undefined),
        ...afterLines,
    ].join("\n");
    const transformedLineRangeStart = getCharIndexAtLineStart(transformedText, selectedLineRange.startLineIndex);

    if (!hasSelection) {
        const originalLine = selectedLines[0] ?? "";
        const transformedLine = transformedLines[0] ?? "";
        const originalLineStart = getCharIndexAtLineStart(text, selectedLineRange.startLineIndex);
        const originalPositionInLine = selectionStart - originalLineStart;
        const transformedPositionInLine = mapPositionThroughLineTransform(originalLine, transformedLine, originalPositionInLine);
        const transformedCaret = transformedLineRangeStart + transformedPositionInLine;
        return { text: transformedText, selectionStart: transformedCaret, selectionEnd: transformedCaret };
    }

    const transformedLineRangeEnd = getCharIndexAtLineStart(
        transformedText,
        selectedLineRange.startLineIndex + selectedLineRange.lineCount + lineCountDelta
    );
    return {
        text: transformedText,
        selectionStart: transformedLineRangeStart,
        selectionEnd: transformedLineRangeEnd,
    };
}

export function getListAtCaretInfo(text: string, caretPosition: number): ListAtCaretInfo {
    const boundedCaretPosition = Math.max(0, Math.min(caretPosition, text.length));
    const lineStart = text.lastIndexOf("\n", boundedCaretPosition - 1) + 1;
    const nextLineBreak = text.indexOf("\n", boundedCaretPosition);
    const lineEnd = nextLineBreak < 0 ? text.length : nextLineBreak;
    const line = text.slice(lineStart, lineEnd);
    const listPrefixMatch = line.match(/^(\s*(?:\d+\.|[+\-*])(?:\s*\[[ xX]\])?\s+)/);

    if (!listPrefixMatch) return { isListItem: false, prefix: "", itemText: "" };

    const prefix = listPrefixMatch[1] ?? "";
    const caretPositionInLine = boundedCaretPosition - lineStart;
    if (caretPositionInLine < prefix.length) {
        return { isListItem: false, prefix: "", itemText: "" };
    }

    return {
        isListItem: true,
        prefix,
        itemText: line.slice(prefix.length).trim(),
    };
}