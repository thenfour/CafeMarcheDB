import { ControlledTextAreaAPI } from "./useControlledTextArea";

export interface MarkdownEditorCommandApi {
    textArea: HTMLTextAreaElement;
    controlledTextArea: ControlledTextAreaAPI;
    nativeFileInputRef: HTMLInputElement;
    saveProgress: () => Promise<void>;
};

export interface MarkdownEditorCommandActionArgs {
    api: MarkdownEditorCommandApi;
    triggeredBy: "toolbar" | "keyboard";
};

export interface MarkdownEditorCommandBase {
    id: string;
};

type MarkdownEditorCommandInvokable = (MarkdownEditorCommandBase & {
    invoke?: undefined;
    keyboardShortcutCondition?: undefined;
}) | (MarkdownEditorCommandBase & {
    invoke?: (args: MarkdownEditorCommandActionArgs) => Promise<void>;
    keyboardShortcutCondition?: { ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean, key: string }; // as in event.key ("A", "B", "[", ...)
});

export type MarkdownEditorCommand = MarkdownEditorCommandInvokable & (({
    toolbarIcon?: React.ReactNode;
    toolbarTooltip?: string;
    toolbarItem?: undefined;
}) | ({
    toolbarItem: React.FC<{ api: MarkdownEditorCommandApi }>;
}));