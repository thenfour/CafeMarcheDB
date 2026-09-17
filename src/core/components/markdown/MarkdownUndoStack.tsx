import React from "react";

import {
    classifyNativeMarkdownEdit,
    MarkdownEditKind,
    MarkdownEditorHistory,
    MarkdownEditorSnapshot,
} from "./MarkdownEditorHistory";

export interface UndoManagerApi {
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    canUndo: boolean;
    canRedo: boolean;
}

interface CapturedNativeEdit {
    before: MarkdownEditorSnapshot;
    inputType: string | undefined;
}

interface UseUndoManagerArgs {
    textValue: string;
    selectionStart: number;
    selectionEnd: number;
    applySnapshot: (snapshot: MarkdownEditorSnapshot) => Promise<void>;
}

export interface UndoManagerController {
    undoManagerApi: UndoManagerApi;
    captureNativeEdit: (
        inputType: string | undefined,
        selectionStart: number,
        selectionEnd: number
    ) => boolean;
    recordNativeEdit: (after: MarkdownEditorSnapshot, inputType: string | undefined) => void;
    recordProgrammaticEdit: (
        before: MarkdownEditorSnapshot,
        after: MarkdownEditorSnapshot,
        editKind?: MarkdownEditKind
    ) => void;
}

function createSnapshot(
    text: string,
    selectionStart: number,
    selectionEnd: number
): MarkdownEditorSnapshot {
    return { text, selectionStart, selectionEnd };
}

export function useUndoManager(args: UseUndoManagerArgs): UndoManagerController {
    const historyRef = React.useRef<MarkdownEditorHistory | null>(null);
    const capturedNativeEditRef = React.useRef<CapturedNativeEdit | null>(null);
    const [, setHistoryRevision] = React.useState(0);

    if (!historyRef.current) {
        historyRef.current = new MarkdownEditorHistory(
            createSnapshot(args.textValue, args.selectionStart, args.selectionEnd)
        );
    }

    const history = historyRef.current;
    const historySnapshot = history.getCurrentSnapshot();
    if (historySnapshot.text !== args.textValue) {
        // A controlled value from outside the editor is a new document baseline.
        history.reset(createSnapshot(args.textValue, args.selectionStart, args.selectionEnd));
        capturedNativeEditRef.current = null;
    }

    const notifyHistoryChanged = () => {
        setHistoryRevision(revision => revision + 1);
    };

    const undo = async () => {
        const snapshot = history.undo();
        if (!snapshot) return;

        capturedNativeEditRef.current = null;
        notifyHistoryChanged();
        await args.applySnapshot(snapshot);
    };

    const redo = async () => {
        const snapshot = history.redo();
        if (!snapshot) return;

        capturedNativeEditRef.current = null;
        notifyHistoryChanged();
        await args.applySnapshot(snapshot);
    };

    const captureNativeEdit = (
        inputType: string | undefined,
        selectionStart: number,
        selectionEnd: number
    ): boolean => {
        if (inputType === "historyUndo") {
            void undo();
            return true;
        }
        if (inputType === "historyRedo") {
            void redo();
            return true;
        }

        capturedNativeEditRef.current = {
            before: createSnapshot(args.textValue, selectionStart, selectionEnd),
            inputType,
        };
        return false;
    };

    const recordNativeEdit = (after: MarkdownEditorSnapshot, inputType: string | undefined) => {
        const capturedNativeEdit = capturedNativeEditRef.current;
        capturedNativeEditRef.current = null;

        const currentSnapshot = history.getCurrentSnapshot();
        const before = capturedNativeEdit?.before.text === args.textValue
            ? capturedNativeEdit.before
            : createSnapshot(args.textValue, currentSnapshot.selectionStart, currentSnapshot.selectionEnd);
        const effectiveInputType = inputType ?? capturedNativeEdit?.inputType;

        history.recordEdit({
            before,
            after,
            editKind: classifyNativeMarkdownEdit(effectiveInputType, before, after),
            timestampMs: Date.now(),
        });
        notifyHistoryChanged();
    };

    const recordProgrammaticEdit = (
        before: MarkdownEditorSnapshot,
        after: MarkdownEditorSnapshot,
        editKind: MarkdownEditKind = "isolated"
    ) => {
        capturedNativeEditRef.current = null;
        history.recordEdit({ before, after, editKind, timestampMs: Date.now() });
        notifyHistoryChanged();
    };

    return {
        undoManagerApi: {
            undo,
            redo,
            canUndo: history.canUndo,
            canRedo: history.canRedo,
        },
        captureNativeEdit,
        recordNativeEdit,
        recordProgrammaticEdit,
    };
}