import { UndoManagerApi, useUndoManager } from "./MarkdownUndoStack";
import {
    getListAtCaretInfo as getListAtCaretInfoFromText,
    isLineBasedSelection as isLineBasedSelectionInText,
    ListAtCaretInfo,
    transformSelectedLines as transformSelectedLinesInText,
} from "./MarkdownTextEditing";

export type { ListAtCaretInfo } from "./MarkdownTextEditing";

interface ReplaceSelectionWithTextOptions {
    select: "change" | "afterChange",
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

    undoManagerApi: UndoManagerApi,
}

export function useControlledTextArea(
    textAreaRef: React.RefObject<HTMLTextAreaElement> | null | undefined,
    textValue: string,
    onTextChange: (val: string) => void
): ControlledTextAreaAPI {

    const textArea = textAreaRef?.current ?? null;

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
        const result = transformSelectedLinesInText(
            textValue,
            textArea.selectionStart,
            textArea.selectionEnd,
            transformLine
        );
        onTextChange(result.text);
        await setSelectionRangeAsync(result.selectionStart, result.selectionEnd);
    }

    const isLineBasedSelection = () => {
        if (!textArea) return false;
        return isLineBasedSelectionInText(textValue, textArea.selectionStart, textArea.selectionEnd);
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
        return getListAtCaretInfoFromText(textValue, textArea.selectionStart);
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

    const undoManagerApi = useUndoManager({
        textareaRef: textAreaRef,
        getState: () => ({
            text: textValue,
            selectionStart: textArea?.selectionStart ?? 0,
            selectionEnd: textArea?.selectionEnd ?? 0,
            charCount: textValue.length,
        }),
        setState: async (state) => {
            onTextChange(state.text);
            await setSelectionRangeAsync(state.selectionStart, state.selectionEnd);
        },
    });

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
        undoManagerApi,
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