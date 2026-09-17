export interface MarkdownEditorSnapshot {
    text: string;
    selectionStart: number;
    selectionEnd: number;
}

export type MarkdownEditKind =
    | "typing"
    | "composition"
    | "deleteBackward"
    | "deleteForward"
    | "isolated";

export interface MarkdownHistoryTransaction {
    before: MarkdownEditorSnapshot;
    after: MarkdownEditorSnapshot;
    editKind: MarkdownEditKind;
    timestampMs: number;
}

export interface MarkdownHistoryConfig {
    maxHistoryEntries: number;
    mergeWindowMs: number;
    maxMergedCharacterCount: number;
}

const kDefaultHistoryConfig: MarkdownHistoryConfig = {
    maxHistoryEntries: 100,
    mergeWindowMs: 750,
    maxMergedCharacterCount: 80,
};

interface ChangedText {
    removedText: string;
    insertedText: string;
}

function copySnapshot(snapshot: MarkdownEditorSnapshot): MarkdownEditorSnapshot {
    return { ...snapshot };
}

function selectionsAreEqual(left: MarkdownEditorSnapshot, right: MarkdownEditorSnapshot): boolean {
    return left.selectionStart === right.selectionStart && left.selectionEnd === right.selectionEnd;
}

function snapshotsAreEqual(left: MarkdownEditorSnapshot, right: MarkdownEditorSnapshot): boolean {
    return left.text === right.text && selectionsAreEqual(left, right);
}

function getChangedText(beforeText: string, afterText: string): ChangedText {
    let commonPrefixLength = 0;
    const maximumPrefixLength = Math.min(beforeText.length, afterText.length);
    while (
        commonPrefixLength < maximumPrefixLength &&
        beforeText[commonPrefixLength] === afterText[commonPrefixLength]
    ) {
        commonPrefixLength += 1;
    }

    let commonSuffixLength = 0;
    const maximumSuffixLength = Math.min(
        beforeText.length - commonPrefixLength,
        afterText.length - commonPrefixLength
    );
    while (
        commonSuffixLength < maximumSuffixLength &&
        beforeText[beforeText.length - commonSuffixLength - 1] === afterText[afterText.length - commonSuffixLength - 1]
    ) {
        commonSuffixLength += 1;
    }

    return {
        removedText: beforeText.slice(commonPrefixLength, beforeText.length - commonSuffixLength),
        insertedText: afterText.slice(commonPrefixLength, afterText.length - commonSuffixLength),
    };
}

function containsLineBreak(text: string): boolean {
    return text.includes("\n") || text.includes("\r");
}

function getChangedCharacterCount(beforeText: string, afterText: string): number {
    const changedText = getChangedText(beforeText, afterText);
    return changedText.removedText.length + changedText.insertedText.length;
}

function isMergeableEditKind(editKind: MarkdownEditKind): boolean {
    return editKind !== "isolated";
}

function shouldMergeTransactions(
    previous: MarkdownHistoryTransaction,
    next: MarkdownHistoryTransaction,
    config: MarkdownHistoryConfig
): boolean {
    if (!isMergeableEditKind(next.editKind) || previous.editKind !== next.editKind) return false;
    if (!snapshotsAreEqual(previous.after, next.before)) return false;
    if (next.timestampMs - previous.timestampMs > config.mergeWindowMs) return false;

    const mergedCharacterCount = getChangedCharacterCount(previous.before.text, next.after.text);
    return mergedCharacterCount <= config.maxMergedCharacterCount;
}

export function classifyNativeMarkdownEdit(
    inputType: string | undefined,
    before: MarkdownEditorSnapshot,
    after: MarkdownEditorSnapshot
): MarkdownEditKind {
    const changedText = getChangedText(before.text, after.text);
    if (containsLineBreak(changedText.removedText) || containsLineBreak(changedText.insertedText)) {
        return "isolated";
    }

    if (inputType?.includes("Composition")) return "composition";
    if (inputType?.includes("Backward")) return "deleteBackward";
    if (inputType?.includes("Forward")) return "deleteForward";
    if (inputType === "insertText") return "typing";

    if (changedText.removedText.length === 0 && changedText.insertedText.length === 1) return "typing";
    if (changedText.removedText.length === 1 && changedText.insertedText.length === 0) {
        return after.selectionStart < before.selectionStart ? "deleteBackward" : "deleteForward";
    }

    return "isolated";
}

export class MarkdownEditorHistory {
    private readonly config: MarkdownHistoryConfig;
    private undoStack: MarkdownHistoryTransaction[] = [];
    private redoStack: MarkdownHistoryTransaction[] = [];
    private currentSnapshot: MarkdownEditorSnapshot;
    private forceNewHistoryEntry = false;

    constructor(initialSnapshot: MarkdownEditorSnapshot, config?: Partial<MarkdownHistoryConfig>) {
        this.currentSnapshot = copySnapshot(initialSnapshot);
        this.config = { ...kDefaultHistoryConfig, ...config };
    }

    recordEdit(transaction: MarkdownHistoryTransaction): void {
        if (transaction.before.text !== this.currentSnapshot.text) {
            this.reset(transaction.before);
        }

        const selectionMovedSincePreviousEdit = !selectionsAreEqual(this.currentSnapshot, transaction.before);
        this.currentSnapshot = copySnapshot(transaction.before);

        if (transaction.before.text === transaction.after.text) {
            this.synchronizeSelection(transaction.after.selectionStart, transaction.after.selectionEnd);
            return;
        }

        const previousTransaction = this.undoStack.at(-1);
        const canMergeWithPrevious =
            !this.forceNewHistoryEntry &&
            !selectionMovedSincePreviousEdit &&
            previousTransaction !== undefined &&
            shouldMergeTransactions(previousTransaction, transaction, this.config);

        if (canMergeWithPrevious) {
            previousTransaction.after = copySnapshot(transaction.after);
            previousTransaction.timestampMs = transaction.timestampMs;
        } else {
            this.undoStack.push({
                ...transaction,
                before: copySnapshot(transaction.before),
                after: copySnapshot(transaction.after),
            });
            this.trimUndoStack();
        }

        this.currentSnapshot = copySnapshot(transaction.after);
        this.redoStack = [];
        this.forceNewHistoryEntry = false;
    }

    synchronizeSelection(selectionStart: number, selectionEnd: number): void {
        if (
            this.currentSnapshot.selectionStart !== selectionStart ||
            this.currentSnapshot.selectionEnd !== selectionEnd
        ) {
            this.currentSnapshot = {
                ...this.currentSnapshot,
                selectionStart,
                selectionEnd,
            };
            this.forceNewHistoryEntry = true;
        }
    }

    reset(snapshot: MarkdownEditorSnapshot): void {
        this.undoStack = [];
        this.redoStack = [];
        this.currentSnapshot = copySnapshot(snapshot);
        this.forceNewHistoryEntry = true;
    }

    undo(): MarkdownEditorSnapshot | undefined {
        const transaction = this.undoStack.pop();
        if (!transaction) return undefined;

        this.redoStack.push(transaction);
        this.currentSnapshot = copySnapshot(transaction.before);
        this.forceNewHistoryEntry = true;
        return copySnapshot(this.currentSnapshot);
    }

    redo(): MarkdownEditorSnapshot | undefined {
        const transaction = this.redoStack.pop();
        if (!transaction) return undefined;

        this.undoStack.push(transaction);
        this.currentSnapshot = copySnapshot(transaction.after);
        this.forceNewHistoryEntry = true;
        return copySnapshot(this.currentSnapshot);
    }

    getCurrentSnapshot(): MarkdownEditorSnapshot {
        return copySnapshot(this.currentSnapshot);
    }

    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    private trimUndoStack(): void {
        const excessEntryCount = this.undoStack.length - this.config.maxHistoryEntries;
        if (excessEntryCount > 0) {
            this.undoStack.splice(0, excessEntryCount);
        }
    }
}