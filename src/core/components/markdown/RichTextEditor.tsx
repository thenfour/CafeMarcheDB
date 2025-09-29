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
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
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

export function MarkdownEditor(props: MarkdownEditorProps) {
    const kb = useKeyboardState();

    const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            props.onFileSelect(e.target.files);
            e.target.files = null; // clear
            e.target.value = ""; // clear
        }
    };

    const handlePaste = (e) => {
        if ((e.clipboardData?.files?.length || 0) > 0) {
            props.onFileSelect(e.clipboardData!.files);
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
            <input
                type="file"
                multiple
                ref={props.nativeFileInputRef}
                style={{ display: 'none' }}
                onChange={handleNativeFileSelect}
            />
            <ReactTextareaAutocomplete
                containerClassName="editorContainer"
                loadingComponent={() => <div>Loading...</div>}
                autoFocus={props.autoFocus}
                innerRef={textarea => props.textAreaRef(textarea)}
                value={props.value || ""}
                height={props.nominalHeight || 400}
                style={{ height: props.nominalHeight }}
                onChange={(e) => {
                    props.onValueChanged(e.target.value);
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

