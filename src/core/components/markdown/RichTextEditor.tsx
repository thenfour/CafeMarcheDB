import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PersonIcon from '@mui/icons-material/Person';
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import "@webscopeio/react-textarea-autocomplete/style.css";
import React from "react";
import TurndownService from 'turndown';

import { QuickSearchItemMatch, QuickSearchItemTypeSets } from 'shared/quickFilter';
import { CollapsableUploadFileComponent, FileDropWrapper } from "../file/FileDrop";
import { fetchObjectQuery } from '../ItemAssociation';
import { fetchInlineClasses } from './MarkdownReactPlugins';
import { useKeyboardState } from '../../hooks/useKeyboardState';
import { NativeTextAreaEdit } from './useControlledTextArea';

var turndownService = new TurndownService();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TODO: use association search / quick search
async function fetchWikiSlugs(keyword: string): Promise<string[]> {
    if (keyword.includes("]]")) return []; // make sure we don't autocomplete outside of the link syntax
    if (!keyword.startsWith("[")) {
        return []; // ensure this is a wiki link. you typed "[" to trigger the autocomplete. this is the 2nd '['
    }
    keyword = keyword.substring(1); // remove the first '['

    const results = await fetchObjectQuery(keyword, QuickSearchItemTypeSets.WikiPages);
    return results.filter(item => !!item.canonicalWikiSlug).map(item => item.canonicalWikiSlug!);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchEventOrSongTagsAt(keyword: string): Promise<QuickSearchItemMatch[]> {
    // no prefix here.
    if (keyword.includes("]]")) return []; // make sure we don't autocomplete outside of the link syntax
    return await fetchObjectQuery(keyword, QuickSearchItemTypeSets.Everything!);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MarkdownEditorProps {
    value: string | null, // value which may be coming from the database.
    onValueChanged: (edit: NativeTextAreaEdit) => void, // caller can save the changed value to a db here.
    onBeforeInput: (inputType: string | undefined, selectionStart: number, selectionEnd: number) => boolean;
    onSave?: () => void,
    nominalHeight: number,
    autoFocus?: boolean;
    displayUploadFileComponent?: boolean;
    onFileSelect: (files: FileList) => void;
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
    const kb = useKeyboardState();

    const handlePaste = (e) => {
        if ((e.clipboardData?.files?.length || 0) > 0) {
            // File paste must not invoke uploads; ordinary text/HTML paste remains active.
            e.preventDefault();
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
        <FileDropWrapper
            className="frontpageGalleryFileUploadWrapper"
            onFileSelect={props.onFileSelect}
            onURLUpload={() => { }}
            progress={props.uploadProgress}
        >
            <ReactTextareaAutocomplete
                containerClassName="editorContainer"
                loadingComponent={() => <div>Loading...</div>}
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
                minChar={1} // how many chars AFTER the trigger char you need to type before the popup arrives

                trigger={{
                    "[[": { // it's hard to understand how these triggers work; are these chars or strings??
                        dataProvider: token => fetchWikiSlugs(token),
                        // renders the item in the suggestion list.
                        component: ({ entity, selected }: { entity: string, selected: boolean }) => <div className={`autoCompleteCMLinkItem wiki ${selected ? "selected" : "notSelected"}`}>{entity}</div>,
                        output: (item: string) => `[[${item}]]`
                    },
                    "{{": { // it's hard to understand how these triggers work; are these chars or strings??
                        dataProvider: token => fetchInlineClasses(token),
                        component: ({ entity, selected }: { entity: string, selected: boolean }) => <div className={`autoCompleteCMLinkItem inlineclass ${selected ? "selected" : "notSelected"}`}>{entity}</div>,
                        output: (item: string) => `{{${item}:}}`
                    },
                    "@": {
                        dataProvider: token => fetchEventOrSongTagsAt(token),
                        component: ({ entity, selected }: { entity: QuickSearchItemMatch, selected: boolean }) => <div className={`autoCompleteCMLinkItem ${entity.itemType} ${selected ? "selected" : "notSelected"}`}>
                            {entity.itemType === "event" && <CalendarMonthIcon />}
                            {entity.itemType === "song" && <MusicNoteIcon />}
                            {entity.itemType === "user" && <PersonIcon />}
                            {/* {entity.itemType === "instrument" && <MusicNoteIcon />} */}
                            {entity.name}
                        </div>,
                        output: (item: QuickSearchItemMatch) => `[[${item.itemType}:${item.id}|${item.name}]]`
                    },
                }}
            />
            {(props.displayUploadFileComponent) && <CollapsableUploadFileComponent
                onFileSelect={props.onFileSelect}
                enablePaste={false} // because paste is handled inline in the textarea.
                progress={props.uploadProgress}
            />}
        </FileDropWrapper>
    </div>
    );
}

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/RichTextEditor.tsx:65-72
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 57d1ce6d5585343b4a3ac412d1507b9cf3427becf74d6633f994365a15fdce2a
// MIGRATION_REFERENCE_BEGIN
//     const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//         if (e.target.files) {
//             props.onFileSelect(e.target.files);
//             e.target.files = null; // clear
//             e.target.value = ""; // clear
//         }
//     };
//
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/RichTextEditor.tsx:75-75
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 71d2d6739c03e1e866168b48a9ecb3b1beda43457bafde66eca1f49636a5f68d
// MIGRATION_REFERENCE_BEGIN
//             props.onFileSelect(e.clipboardData!.files);
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/RichTextEditor.tsx:103-109
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: a8fe2786a31a0186ea93159cbac3150acb61829ac9f933b053b2327013de491c
// MIGRATION_REFERENCE_BEGIN
//             <input
//                 type="file"
//                 multiple
//                 ref={props.nativeFileInputRef}
//                 style={{ display: 'none' }}
//                 onChange={handleNativeFileSelect}
//             />
// MIGRATION_REFERENCE_END
