import { DashboardContextData } from "../DashboardContext";
import { ControlledTextAreaAPI } from "./useControlledTextArea";

export type MarkdownContextMap = {
    [commandId: string]: MarkdownTokenContext | undefined; // key = command id.
};

// some comands can't really just use invoke() to do a command. like the "mentions",
// which uses a dialog in its toolbar item. so the toolbar item needs to be able to detect
// when the editor is requesting it to "invoke". the trigger will do it.
export type MarkdownCommandInvocationTriggerMap = {
    [commandId: string]: number;
};


export interface MarkdownEditorCommandApi {
    dashboardContext: DashboardContextData;
    textArea: HTMLTextAreaElement;
    controlledTextArea: ControlledTextAreaAPI;
    nativeFileInputRef: HTMLInputElement;
    saveProgress: () => Promise<void>;
    contextMap: MarkdownContextMap;
    invocationTriggerMap: MarkdownCommandInvocationTriggerMap;
};

export interface MarkdownEditorCommandActionArgs {
    api: MarkdownEditorCommandApi;
    triggeredBy: "toolbar" | "keyboard";
};

export interface MarkdownTokenContext {
    start: number;
    end: number;
};

export interface MarkdownEditorCommandBase {
    id: string;
    isEnabled?: (api: MarkdownEditorCommandApi) => boolean;
    deduceContext?: (api: MarkdownEditorCommandApi) => undefined | MarkdownTokenContext;
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
    toolbarItem: React.FC<{ api: MarkdownEditorCommandApi, invocationTrigger: number }>;
}));