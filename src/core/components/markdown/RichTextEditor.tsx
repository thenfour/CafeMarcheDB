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

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/markdown/RichTextEditor.tsx:1-3
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 7540d3e4ba883b7783873eb473cbcfb9f33d852f73fa02564128a5b29344b3bc
// MIGRATION_REFERENCE_BEGIN
// import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
// import MusicNoteIcon from '@mui/icons-material/MusicNote';
// import PersonIcon from '@mui/icons-material/Person';
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/markdown/RichTextEditor.tsx:6-6
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 9abf3e6700d98954fe8bbe11cbda048f525400b21632402972b47c423c1be127
// MIGRATION_REFERENCE_BEGIN
// import React from "react";
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/markdown/RichTextEditor.tsx:9-9
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 8fa305dc55b1abc3f6954c239a0c3fbed929164b5635ed2a3560e0e69857ed5f
// MIGRATION_REFERENCE_BEGIN
// import { QuickSearchItemMatch, QuickSearchItemTypeSets } from 'shared/quickFilter';
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/markdown/RichTextEditor.tsx:11-11
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 89a5cb25f28085d9b3f2fbe3ccf3583c4ad1b4cd70f15681a0e8740e7ddd5775
// MIGRATION_REFERENCE_BEGIN
// import { fetchObjectQuery } from '../ItemAssociation';
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/markdown/RichTextEditor.tsx:18-39
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 3849e97684ccf4814ebe09c479c4b6469d9ea4402d9319dcc54406e36f11839e
// MIGRATION_REFERENCE_BEGIN
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// // TODO: use association search / quick search
// async function fetchWikiSlugs(keyword: string): Promise<string[]> {
//     if (keyword.includes("]]")) return []; // make sure we don't autocomplete outside of the link syntax
//     if (!keyword.startsWith("[")) {
//         return []; // ensure this is a wiki link. you typed "[" to trigger the autocomplete. this is the 2nd '['
//     }
//     keyword = keyword.substring(1); // remove the first '['
//
//     const results = await fetchObjectQuery(keyword, QuickSearchItemTypeSets.WikiPages);
//     return results.filter(item => !!item.canonicalWikiSlug).map(item => item.canonicalWikiSlug!);
// }
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// async function fetchEventOrSongTagsAt(keyword: string): Promise<QuickSearchItemMatch[]> {
//     // no prefix here.
//     if (keyword.includes("]]")) return []; // make sure we don't autocomplete outside of the link syntax
//     return await fetchObjectQuery(keyword, QuickSearchItemTypeSets.Everything!);
// }
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/markdown/RichTextEditor.tsx:88-88
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 4c4b27b562166d3cbac183d4ddebf6ed695579c7eef27ff0670d89c94259abdc
// MIGRATION_REFERENCE_BEGIN
//     return (<div className="FileUploadWrapperContainer">
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/markdown/RichTextEditor.tsx:128-133
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 8f537aff7a7e09809953ee1e50fd2d2ec243ac6e09d05f5d3df428ad5ce45c02
// MIGRATION_REFERENCE_BEGIN
//                     "[[": { // it's hard to understand how these triggers work; are these chars or strings??
//                         dataProvider: token => fetchWikiSlugs(token),
//                         // renders the item in the suggestion list.
//                         component: ({ entity, selected }: { entity: string, selected: boolean }) => <div className={`autoCompleteCMLinkItem wiki ${selected ? "selected" : "notSelected"}`}>{entity}</div>,
//                         output: (item: string) => `[[${item}]]`
//                     },
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/markdown/RichTextEditor.tsx:139-149
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 454e38972139177d9385537ff1b83146c8a9a0d0d5cfc4c621a443c45f609a5d
// MIGRATION_REFERENCE_BEGIN
//                     "@": {
//                         dataProvider: token => fetchEventOrSongTagsAt(token),
//                         component: ({ entity, selected }: { entity: QuickSearchItemMatch, selected: boolean }) => <div className={`autoCompleteCMLinkItem ${entity.itemType} ${selected ? "selected" : "notSelected"}`}>
//                             {entity.itemType === "event" && <CalendarMonthIcon />}
//                             {entity.itemType === "song" && <MusicNoteIcon />}
//                             {entity.itemType === "user" && <PersonIcon />}
//                             {/* {entity.itemType === "instrument" && <MusicNoteIcon />} */}
//                             {entity.name}
//                         </div>,
//                         output: (item: QuickSearchItemMatch) => `[[${item.itemType}:${item.id}|${item.name}]]`
//                     },
// MIGRATION_REFERENCE_END
