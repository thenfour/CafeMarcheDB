import { useEffect, useRef } from 'react';

export interface UndoPoint {
    text: string;
    selectionStart: number;
    selectionEnd: number;
}

export interface MergeConfig {
    maxCharCount: number; // e.g., 80 characters
}

export class MergeStrategy {
    private config: MergeConfig;
    private lastChar?: string;

    constructor(config: MergeConfig) {
        this.config = config;
    }

    /**
     * Decide if we should "close" (i.e. push a new point)
     * or continue merging with the current top.
     *
     * NOTE: This does NOT handle the "onBlur" finalization or similar forced splits.
     * That is handled at a higher level via `forceNewPointNextTime`.
     */
    shouldClose(
        currentUndo: UndoPoint,
        newContent: string,
        newSelectionStart: number,
        newSelectionEnd: number,
        eventType: 'input' | 'paste' | 'manualCaret'
    ): boolean {
        // If the currentUndo is empty, we have no meaningful content yet => push new point.
        if (!currentUndo.text && currentUndo.selectionStart === 0 && currentUndo.selectionEnd === 0) {
            return true;
        }

        // Pasting or manual caret => force new point so as not to merge across different user actions.
        if (eventType === 'paste' || eventType === 'manualCaret') {
            return true;
        }

        // Check if the difference in text length triggers a new point.
        const charDelta = Math.abs(newContent.length - currentUndo.text.length);
        if (charDelta >= this.config.maxCharCount) {
            return true;
        }

        // If the newly added character is a newline and the previous character wasn't a newline, treat it as a break.
        const lastCharOfNewContent = newContent.charAt(newSelectionStart - 1);
        if (lastCharOfNewContent === '\n' && this.lastChar !== '\n') {
            this.lastChar = lastCharOfNewContent;
            return true;
        }

        // Update lastChar to detect consecutive newlines next time.
        this.lastChar = newContent.charAt(newContent.length - 1);

        // Otherwise, merge into the top of the stack.
        return false;
    }
}

export class UndoManager {
    private undoStack: UndoPoint[] = [];
    private redoStack: UndoPoint[] = [];
    private mergeStrategy: MergeStrategy;
    /**
     * This flag indicates that the next change (the next time recordChange is called)
     * should always create a new undo point rather than merging.
     */
    private forceNewPointNextTime = false;

    constructor(config: MergeConfig) {
        this.mergeStrategy = new MergeStrategy(config);
    }

    private createUndoPoint(text: string, selectionStart: number, selectionEnd: number): UndoPoint {
        return { text, selectionStart, selectionEnd };
    }

    /**
     * Record a change in the text or selection.
     *
     * - If there's no *meaningful* difference (text & selection are the same), skip.
     * - Otherwise, if `forceNewPointNextTime` is true, push a new point.
     * - Else we rely on MergeStrategy to decide if we should close or merge.
     * - Clear redoStack on every new change.
     *
     * Special: On blur, we set `forceNewPointNextTime` to ensure the *next* edit is forced into a new point.
     */
    recordChange(
        newContent: string,
        newSelectionStart: number,
        newSelectionEnd: number,
        eventType: 'input' | 'paste' | 'manualCaret' | 'blur'
    ) {
        const top = this.peek(); // top-of-stack or empty if none

        // 1) If blur event => finalize the current batch so that the next change won't merge.
        if (eventType === 'blur') {
            // We only push a new point on blur if there's a difference from the last known top.
            // This "finalizes" any unsaved changes in the top.
            const hasTextChanged = newContent !== top.text;
            const hasSelectionChanged =
                newSelectionStart !== top.selectionStart || newSelectionEnd !== top.selectionEnd;

            if (hasTextChanged || hasSelectionChanged) {
                // If the top is different, push a final point for it:
                this.undoStack.push(this.createUndoPoint(newContent, newSelectionStart, newSelectionEnd));
            }
            // Either way, set the flag so next time we do a new point.
            this.forceNewPointNextTime = true;
            // Clear redo stack on new changes or finalization.
            this.redoStack = [];
            return;
        }

        // 2) For any event that isn't blur, check if there's a meaningful difference from the top:
        const isTextDifferent = newContent !== top.text;
        const isSelectionDifferent =
            newSelectionStart !== top.selectionStart || newSelectionEnd !== top.selectionEnd;
        if (!isTextDifferent && !isSelectionDifferent) {
            // No meaningful change => do nothing.
            return;
        }

        // 3) If we previously set forceNewPointNextTime => always create a new point now.
        if (this.forceNewPointNextTime) {
            this.undoStack.push(this.createUndoPoint(newContent, newSelectionStart, newSelectionEnd));
            this.forceNewPointNextTime = false;
            this.redoStack = [];
            return;
        }

        // 4) We rely on the MergeStrategy to decide if we should close or merge.
        const shouldClose = this.mergeStrategy.shouldClose(
            top,
            newContent,
            newSelectionStart,
            newSelectionEnd,
            eventType
        );
        if (shouldClose) {
            // Close => push a new undo point
            const newPoint = this.createUndoPoint(newContent, newSelectionStart, newSelectionEnd);
            this.undoStack.push(newPoint);
        } else {
            // Merge => update the top of the stack
            if (this.undoStack.length === 0) {
                this.undoStack.push(this.createUndoPoint(newContent, newSelectionStart, newSelectionEnd));
            } else {
                this.undoStack[this.undoStack.length - 1] = {
                    text: newContent,
                    selectionStart: newSelectionStart,
                    selectionEnd: newSelectionEnd,
                };
            }
        }

        // 5) Always clear redo stack after a new or merged change
        this.redoStack = [];
    }

    /**
     * Undo: Pop from undoStack, push to redoStack, return the new top state.
     */
    undo(): UndoPoint {
        if (this.undoStack.length === 0) {
            return this.createUndoPoint('', 0, 0);
        }
        const lastState = this.undoStack.pop()!;
        this.redoStack.push(lastState);

        // Invalidate merges going forward, so the next typed char starts fresh
        this.forceNewPointNextTime = true;

        return this.peek();
    }

    /**
     * Redo: Pop from redoStack, push onto undoStack, return that state.
     */
    redo(): UndoPoint | undefined {
        if (this.redoStack.length === 0) return undefined;
        const restored = this.redoStack.pop()!;
        this.undoStack.push(restored);

        // Also force the next typed char to start fresh
        this.forceNewPointNextTime = true;

        return restored;
    }

    /**
     * Returns the top-of-stack or an "empty" undo point if stack is empty.
     */
    peek(): UndoPoint {
        if (this.undoStack.length === 0) {
            return this.createUndoPoint('', 0, 0);
        }
        return this.undoStack[this.undoStack.length - 1]!;
    }

    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }
    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }
}


export interface UndoManagerApi {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    recordChange: (eventType: 'input' | 'paste' | 'manualCaret' | 'blur') => void;
};


interface UseUndoManagerArgs {
    textareaRef: React.RefObject<HTMLTextAreaElement> | null | undefined;
    getState: () => UndoPoint;
    setState: (state: UndoPoint) => void;
    config?: MergeConfig;
};

// React hook encapsulating integration with a textarea.
export function useUndoManager({ ...args }: UseUndoManagerArgs): UndoManagerApi {
    const { textareaRef } = args;
    if (!textareaRef) {
        return { undo: () => { }, redo: () => { }, recordChange: () => { }, canUndo: false, canRedo: false };
    }
    // Instantiate UndoManager using a ref so it's stable between renders.
    const undoManagerRef = useRef<UndoManager>(new UndoManager(args.config || { maxCharCount: 80 }));

    // Record a change using current textarea state.
    const recordChange = (eventType: 'input' | 'paste' | 'manualCaret' | 'blur') => {
        if (!textareaRef.current) return;

        const state = args.getState();

        undoManagerRef.current.recordChange(
            state.text,
            state.selectionStart,
            state.selectionEnd,
            // textareaRef.current.value,
            // textareaRef.current.selectionStart,
            // textareaRef.current.selectionEnd,
            eventType
        );
    };

    // Setup event listeners on the textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const onInput = () => recordChange('input');
        const onPaste = () => recordChange('paste');
        const onBlur = () => recordChange('blur');

        // For caret movements, we use keydown.
        const onKeyDown = (event: KeyboardEvent) => {
            const caretChangingKeys = [
                'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                'Home', 'End', 'PageUp', 'PageDown'
            ];
            if (caretChangingKeys.includes(event.key)) {
                // Use setTimeout to ensure the selection change is applied.
                setTimeout(() => {
                    recordChange('manualCaret');
                }, 0);
            }
        };

        textarea.addEventListener('input', onInput);
        textarea.addEventListener('paste', onPaste);
        textarea.addEventListener('blur', onBlur);
        textarea.addEventListener('keydown', onKeyDown);

        return () => {
            textarea.removeEventListener('input', onInput);
            textarea.removeEventListener('paste', onPaste);
            textarea.removeEventListener('blur', onBlur);
            textarea.removeEventListener('keydown', onKeyDown);
        };
    }, [textareaRef, recordChange]);

    // Functions to trigger undo and redo.
    const undo = () => {
        const state = undoManagerRef.current.undo();
        console.log(`undo called; state=`, state);
        if (state && textareaRef.current) {
            args.setState(state);
            // textareaRef.current.value = state.text;
            // textareaRef.current.setSelectionRange(state.selectionStart, state.selectionEnd);
        }
    };

    const redo = () => {
        const state = undoManagerRef.current.redo();
        console.log(`redo called, state`, state);
        if (state && textareaRef.current) {
            args.setState(state);
            // textareaRef.current.value = state.text;
            // textareaRef.current.setSelectionRange(state.selectionStart, state.selectionEnd);
        }
    };

    return {
        undo,
        redo,
        canUndo: undoManagerRef.current.canUndo,
        canRedo: undoManagerRef.current.canRedo,
        recordChange
    };
}


