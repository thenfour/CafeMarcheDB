import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import "@webscopeio/react-textarea-autocomplete/style.css";
import React from "react";
import { QuickSearchRecoveryNotice } from "../search/QuickSearchRecoveryNotice";
import TurndownService from 'turndown';

import { CollapsableUploadFileComponent, FileDropWrapper } from "../file/FileDrop";
import { fetchInlineClasses } from './MarkdownReactPlugins';
import { useKeyboardState } from '../../hooks/useKeyboardState';
import { NativeTextAreaEdit } from './useControlledTextArea';
import { useMarkdownReferenceSuggestions } from './useMarkdownReferenceSuggestions';
import { useLocale } from 'src/locale/components/useLocale';

var turndownService = new TurndownService();

interface MarkdownEditorProps {
    referenceSearchEnabled: boolean;
    uploadsEnabled: boolean;
    value: string | null, // value which may be coming from the database.
    onValueChanged: (edit: NativeTextAreaEdit) => void, // caller can save the changed value to a db here.
    onBeforeInput: (inputType: string | undefined, selectionStart: number, selectionEnd: number) => boolean;
    onSave?: () => void,
    nominalHeight: number,
    autoFocus?: boolean;
    displayUploadFileComponent?: boolean;
    onFileSelect: (files: FileList) => void;
    onURLUpload: (url: string) => void;
    uploadProgress: number | null;
    onCustomPaste?: (pastedHtml: string) => void;

    textAreaRef: (ref: HTMLTextAreaElement | null) => void; // ref to the textarea element.
    nativeFileInputRef: (ref: HTMLInputElement | null) => void; // ref to the native file input element.
}

function getInputType(nativeEvent: Event | undefined): string | undefined {
    if (!nativeEvent) return undefined; // hitting ctrl+Z produces no native event but does produce onChange.
    if (!("inputType" in nativeEvent) || typeof nativeEvent.inputType !== "string") return undefined;
    return nativeEvent.inputType;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
    return props.referenceSearchEnabled ? <MarkdownEditorWithReferences {...props} />
        : <MarkdownTextEditor {...props} referenceTriggers={null} />;
}

function MarkdownEditorWithReferences(props: MarkdownEditorProps) {
    const textarea = React.useRef<HTMLTextAreaElement | null>(null);
    const suggestions = useMarkdownReferenceSuggestions(props.referenceSearchEnabled, textarea);
    return <MarkdownTextEditor {...props} referenceTriggers={suggestions.triggers} invalidateSuggestions={suggestions.invalidate}
        textAreaRef={element => { textarea.current = element; props.textAreaRef(element); }} />;
}

function MarkdownTextEditor(props: MarkdownEditorProps & {
    referenceTriggers: ReturnType<typeof useMarkdownReferenceSuggestions>["triggers"] | null;
    invalidateSuggestions?: () => void;
}) {
    const kb = useKeyboardState();
    const locale = useLocale();

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if ((e.clipboardData?.files?.length || 0) > 0) {
            e.preventDefault();
            if (props.uploadsEnabled && props.uploadProgress === null) {
                props.onFileSelect(e.clipboardData.files);
            }
            return;
        }

        // Allow raw (untransformed) paste only when explicit raw-paste shortcut was used.
        if (kb.consumeRawPasteIntent()) {
            // Let the browser perform the default paste (usually plain text).
            return;
        }

        // TODO: rich text paste handling via turndown.
        // if text/html, then use turndown
        const pastedHtml = e.clipboardData?.getData('text/html');
        if (pastedHtml) {
            const turndownResult = turndownService.turndown(pastedHtml);
            props.onCustomPaste?.(turndownResult); // call the custom paste handler.
            e.preventDefault(); // prevent the default paste action.
        }
    };

    return (<div className="FileUploadWrapperContainer">
        {!props.referenceSearchEnabled && <QuickSearchRecoveryNotice />}
        <FileDropWrapper
            enabled={props.uploadsEnabled}
            className="frontpageGalleryFileUploadWrapper"
            onFileSelect={props.onFileSelect}
            onURLUpload={props.onURLUpload}
            progress={props.uploadProgress}
        >
            {props.uploadsEnabled && <input type="file" multiple hidden
                ref={props.nativeFileInputRef} disabled={props.uploadProgress !== null}
                onChange={event => {
                    if (props.uploadProgress === null && event.currentTarget.files?.length) {
                        props.onFileSelect(event.currentTarget.files);
                    }
                    // Choosing the same file again must still emit a change event.
                    event.currentTarget.value = "";
                }} />}
            <ReactTextareaAutocomplete
                containerClassName="editorContainer"
                loadingComponent={() => <div>{locale.getPlainString("markdown.reference.loading")}</div>}
                autoFocus={props.autoFocus}
                innerRef={textarea => props.textAreaRef(textarea)}
                value={props.value || ""}
                height={props.nominalHeight || 400}
                style={{ height: props.nominalHeight }}
                onBeforeInput={(event: React.FormEvent<HTMLTextAreaElement>) => {
                    const inputWasHandled = props.onBeforeInput(
                        getInputType(event.nativeEvent),
                        event.currentTarget.selectionStart,
                        event.currentTarget.selectionEnd
                    );
                    if (inputWasHandled) {
                        event.preventDefault();
                    }
                }}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    props.invalidateSuggestions?.();
                    //console.log(`onChange event e=`, e, "nativeEvent=", e.nativeEvent);
                    const inputType = getInputType(e.nativeEvent);
                    //console.log(`inputType=${inputType}`);
                    props.onValueChanged({
                        text: e.target.value,
                        selectionStart: e.target.selectionStart,
                        selectionEnd: e.target.selectionEnd,
                        inputType,
                    });
                }}
                onPaste={handlePaste}
                onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (event.key === "Escape") {
                        props.invalidateSuggestions?.();
                    }
                }}
                minChar={1} // how many chars AFTER the trigger char you need to type before the popup arrives

                trigger={{
                    ...props.referenceTriggers,
                    "{{": { // it's hard to understand how these triggers work; are these chars or strings??
                        dataProvider: token => fetchInlineClasses(token),
                        component: ({ entity, selected }: { entity: string, selected: boolean }) => <div className={`autoCompleteCMLinkItem inlineclass ${selected ? "selected" : "notSelected"}`}>{entity}</div>,
                        output: (item: string) => `{{${item}:}}`
                    },
                }}
            />
            {(props.displayUploadFileComponent) && <CollapsableUploadFileComponent
                enabled={props.uploadsEnabled}
                onFileSelect={props.onFileSelect}
                onURLUpload={props.onURLUpload}
                enablePaste={false} // because paste is handled inline in the textarea.
                progress={props.uploadProgress}
            />}
        </FileDropWrapper>
    </div>
    );
}
