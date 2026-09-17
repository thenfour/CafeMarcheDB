import React from "react";

import { MarkdownEditKind, MarkdownEditorSnapshot } from "./MarkdownEditorHistory";
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
    historyEditKind?: MarkdownEditKind;
}

export interface NativeTextAreaEdit {
    text: string;
    selectionStart: number;
    selectionEnd: number;
    inputType: string | undefined;
}

interface PendingSelectionRestore {
    expectedText: string;
    selectionStart: number;
    selectionEnd: number;
    resolve: () => void;
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

    handleNativeBeforeInput: (inputType: string | undefined, selectionStart: number, selectionEnd: number) => boolean;
    handleNativeTextChange: (edit: NativeTextAreaEdit) => void;

    undoManagerApi: UndoManagerApi,
}

export function useControlledTextArea(
    textAreaRef: React.RefObject<HTMLTextAreaElement> | null | undefined,
    textValue: string,
    onTextChange: (val: string) => void
): ControlledTextAreaAPI {

    const getTextArea = () => textAreaRef?.current ?? null;
    const textArea = getTextArea();
    const pendingSelectionRestoreRef = React.useRef<PendingSelectionRestore | null>(null);

    const setSelectionRange = async (start: number, end: number) => {
        return new Promise<void>((resolve) => {
            const textArea = getTextArea();
            if (!textArea) return resolve();
            textArea.setSelectionRange(start, end);
            textArea.focus();
            setTimeout(() => {
                resolve();
            }, 0); // wait for the focus to be applied before resolving.
        });
    };
    React.useLayoutEffect(() => {
        const pendingSelectionRestore = pendingSelectionRestoreRef.current;
        if (!pendingSelectionRestore || pendingSelectionRestore.expectedText !== textValue) return;

        pendingSelectionRestoreRef.current = null;
        const textArea = getTextArea();
        if (textArea) {
            textArea.setSelectionRange(
                pendingSelectionRestore.selectionStart,
                pendingSelectionRestore.selectionEnd
            );
            textArea.focus();
        }
        pendingSelectionRestore.resolve();
    }, [textValue, textAreaRef]);

    const setTextAndSelection = (
        text: string,
        selectionStart: number,
        selectionEnd: number
    ): Promise<void> => {
        if (text === textValue) {
            return setSelectionRange(selectionStart, selectionEnd);
        }

        return new Promise(resolve => {
            pendingSelectionRestoreRef.current?.resolve();
            pendingSelectionRestoreRef.current = {
                expectedText: text,
                selectionStart,
                selectionEnd,
                resolve,
            };
            onTextChange(text);
        });
    };

    const applyHistorySnapshot = async (snapshot: MarkdownEditorSnapshot) => {
        await setTextAndSelection(snapshot.text, snapshot.selectionStart, snapshot.selectionEnd);
    };

    const undoManagerController = useUndoManager({
        textValue,
        selectionStart: textArea?.selectionStart ?? 0,
        selectionEnd: textArea?.selectionEnd ?? 0,
        applySnapshot: applyHistorySnapshot,
    });

    const getCurrentSnapshot = (): MarkdownEditorSnapshot => ({
        text: textValue,
        selectionStart: getTextArea()?.selectionStart ?? 0,
        selectionEnd: getTextArea()?.selectionEnd ?? 0,
    });

    const applyProgrammaticEdit = async (
        start: number,
        end: number,
        replacement: string,
        selectionStart: number,
        selectionEnd: number,
        editKind: MarkdownEditKind = "isolated"
    ) => {
        const before = getCurrentSnapshot();
        const after: MarkdownEditorSnapshot = {
            text: textValue.slice(0, start) + replacement + textValue.slice(end),
            selectionStart,
            selectionEnd,
        };

        undoManagerController.recordProgrammaticEdit(before, after, editKind);
        await setTextAndSelection(after.text, after.selectionStart, after.selectionEnd);
    };

    const getSelectedText = () => {
        const textArea = getTextArea();
        if (!textArea) return "";
        return textValue.slice(textArea.selectionStart, textArea.selectionEnd);
    };

    const replaceRange = async (start: number, end: number, replacement: string) => {
        const caretAfterReplacement = start + replacement.length;
        await applyProgrammaticEdit(
            start,
            end,
            replacement,
            caretAfterReplacement,
            caretAfterReplacement
        );
    };

    async function transformSelectedLines(
        transformLine: (text: string, lineIndex: number, allSelectedLines: string[]) => string | undefined
    ) {
        const textArea = getTextArea();
        if (!textArea) return;
        const result = transformSelectedLinesInText(
            textValue,
            textArea.selectionStart,
            textArea.selectionEnd,
            transformLine
        );
        const before = getCurrentSnapshot();
        const after: MarkdownEditorSnapshot = {
            text: result.text,
            selectionStart: result.selectionStart,
            selectionEnd: result.selectionEnd,
        };
        undoManagerController.recordProgrammaticEdit(before, after);
        await setTextAndSelection(after.text, after.selectionStart, after.selectionEnd);
    }

    const isLineBasedSelection = () => {
        const textArea = getTextArea();
        if (!textArea) return false;
        return isLineBasedSelectionInText(textValue, textArea.selectionStart, textArea.selectionEnd);
    };

    /**
     * Attempts to detect if the caret is on a line that is recognized
     * as a Markdown list (unordered, ordered, or task list).
     * Returns the entire list prefix if it matches, otherwise { isList: false, prefix: "" }.
     */
    function getListAtCaretInfo(): ListAtCaretInfo {
        const textArea = getTextArea();
        if (!textArea) {
            return { isListItem: false, prefix: "", itemText: "" };
        }
        return getListAtCaretInfoFromText(textValue, textArea.selectionStart);
    }

    const surroundSelectionWithText = async (prefix: string, suffix: string, textIfNoSelection: string) => {
        const textArea = getTextArea();
        const start = textArea?.selectionStart ?? 0;
        const end = textArea?.selectionEnd ?? 0;
        const selectedText = textValue.slice(start, end);

        if (end - start > 0) {
            // there's a selection; surround it.
            const existingTextStart = start + prefix.length;
            const suffixStart = existingTextStart + selectedText.length;
            await applyProgrammaticEdit(
                start,
                end,
                prefix + selectedText + suffix,
                existingTextStart,
                suffixStart
            );
        } else {
            // No selection, insert the default text highlighted
            const existingTextStart = start + prefix.length;
            const suffixStart = existingTextStart + textIfNoSelection.length;
            await applyProgrammaticEdit(
                start,
                start,
                prefix + textIfNoSelection + suffix,
                existingTextStart,
                suffixStart
            );
        }
    };

    const replaceSelectionWithText = async (
        replacement: string,
        options: ReplaceSelectionWithTextOptions = { select: "afterChange" }
    ) => {
        const textArea = getTextArea();
        const start = textArea?.selectionStart ?? 0;
        const end = textArea?.selectionEnd ?? 0;
        const selectionStart = options.select === "change" ? start : start + replacement.length;
        const selectionEnd = start + replacement.length;
        await applyProgrammaticEdit(
            start,
            end,
            replacement,
            selectionStart,
            selectionEnd,
            options.historyEditKind
        );
    };

    const handleNativeTextChange = (edit: NativeTextAreaEdit) => {
        undoManagerController.recordNativeEdit({
            text: edit.text,
            selectionStart: edit.selectionStart,
            selectionEnd: edit.selectionEnd,
        }, edit.inputType);
        onTextChange(edit.text);
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
        handleNativeBeforeInput: undoManagerController.captureNativeEdit,
        handleNativeTextChange,
        undoManagerApi: undoManagerController.undoManagerApi,
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

            const currentTextArea = getTextArea();
            const selectionStart = currentTextArea?.selectionStart ?? 0;
            const selectionEnd = currentTextArea?.selectionEnd ?? 0;

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