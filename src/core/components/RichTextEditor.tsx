// <Markdown> = rendered markdown text (simple read only html)
// <MarkdownEditor> = just the text editor which outputs markdown
// <MarkdownControl> = full editor with debounced commitment (caller actually commits), displays saving indicator, switch between edit/view

// todo: paste attachments
import { Button, CircularProgress } from "@mui/material";
import MarkdownIt from 'markdown-it';
import React from "react";
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import "@webscopeio/react-textarea-autocomplete/style.css";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PersonIcon from '@mui/icons-material/Person';

import { SnackbarContext } from "src/core/components/SnackbarContext"; // 0 internal refs
import { MatchingSlugItem } from "../db3/shared/apiTypes"; // 0 internal refs
import { useDebounce } from "shared/useDebounce"; // 0 internal refs
import { CoerceToBoolean, IsNullOrWhitespace, isValidURL, parseMimeType } from "shared/utils";
import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";

import { CMSmallButton } from "./CMCoreComponents2";
import { CMDBUploadFile } from "./CMDBUploadFile";
import { CollapsableUploadFileComponent, FileDropWrapper, UploadFileComponent } from "./FileDrop";
import { getURLClass } from "../db3/clientAPILL";

function markdownItImageDimensions(md) {
    const defaultRender = md.renderer.rules.image || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const srcIndex = token.attrIndex('src');

        if (srcIndex >= 0) {
            const srcAttr = token.attrs[srcIndex][1];
            const dimensionMatch = srcAttr.match(/^(.*?)(\?\d+)$/);

            if (dimensionMatch && dimensionMatch.length > 2) {
                const url = dimensionMatch[1]; // The actual URL without the dimension part
                const dimension = dimensionMatch[2].substring(1); // Remove the '?' to get the dimension

                // Update the src attribute to the clean URL without the dimension query
                token.attrs[srcIndex][1] = url;

                // Apply the dimension as a style for both max-width and max-height
                token.attrPush(['style', `max-width: ${dimension}px; max-height: ${dimension}px;`]);
            }
        }

        return defaultRender(tokens, idx, options, env, self);
    };
};


function cmLinkPlugin(md) {
    const defaultRender = md.renderer.rules.html_inline || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.text = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        // Updated regex to capture both old and new link types
        const linkRegex = /\[\[(event|song):(\d+)\|?(.*?)\]\]/g;

        if (token.content.match(linkRegex)) {
            token.content = token.content.replace(linkRegex, (match, type, id, caption) => {
                if (id && type === 'event') {
                    caption = caption || `Event ${id}`; // Default caption if none provided
                    return `<a href="/backstage/event/${id}" class="wikiCMLink wikiEventLink">📅 ${caption}</a>`;
                }
                if (id && type === 'song') {
                    caption = caption || `Song ${id}`; // Default caption if none provided
                    return `<a href="/backstage/song/${id}" class="wikiCMLink wikiSongLink">🎵 ${caption}</a>`;
                }
            });
        }

        const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

        if (token.content.match(wikiRegex)) {
            token.content = token.content.replace(wikiRegex, (match, slug, caption) => {
                if (slug) {
                    caption = caption || slug;
                    return `<a href="/backstage/wiki/${slugify(slug)}" class="wikiCMLink wikiWikiLink">${caption}</a>`;
                }
            });
        }

        return defaultRender(tokens, idx, options, env, self);
    };
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MarkdownProps {
    markdown: string | null,
    id?: string,
    className?: string,
    compact?: boolean,
    onClick?: () => void,
}
export const Markdown = (props: MarkdownProps) => {
    const [html, setHtml] = React.useState('');

    React.useEffect(() => {
        if (IsNullOrWhitespace(props.markdown)) {
            setHtml("");
            return;
        }
        const md = new MarkdownIt();

        // https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
        // this adds attribute target=_blank so links open in new tab.
        // Remember old renderer, if overridden, or proxy to default renderer
        var defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
            // If you are sure other plugins can't add `target` - drop check below
            var ihref = tokens[idx].attrIndex('href');
            //console.log(tokens[idx]);
            let className = " externalLink";
            let addTargetBlank = true;

            if (ihref >= 0) {
                // distinguish internal vs. external.
                const href = tokens[idx].attrs[ihref][1];
                console.log(href);
                if (href) {
                    const hrefClass = getURLClass(href);
                    switch (hrefClass) {
                        case "external":
                            className = " externalLink opensInNewTab";
                            addTargetBlank = true;
                            break;
                        case "internalAPI":
                            className = " internalAPILink opensInNewTab";
                            addTargetBlank = true;
                            break;
                        case "internalPage":
                            className = " internalPageLink";
                            addTargetBlank = false;
                            break;
                    }
                }
            }

            var itarget = tokens[idx].attrIndex('target');
            if (addTargetBlank) {
                if (itarget < 0) {
                    tokens[idx].attrPush(['target', '_blank']); // add new attribute
                } else {
                    tokens[idx].attrs[itarget][1] = '_blank';    // replace value of existing attr
                }
            }

            // add class
            var iclass = tokens[idx].attrIndex('class');
            if (iclass < 0) {
                tokens[idx].attrPush(['class', className]);
            } else {
                tokens[idx].attrs[iclass][1] += className;
            }

            // pass token to default renderer.
            return defaultRender(tokens, idx, options, env, self);
        };
        md.use(cmLinkPlugin);
        md.use(markdownItImageDimensions);

        setHtml(md.render(props.markdown));
    }, [props.markdown]);

    return <div className={`markdown renderedContent ${props.compact && "compact"} ${props.className || ""}`} onClick={props.onClick}>
        <div id={props.id} dangerouslySetInnerHTML={{ __html: html }}></div>
    </div >;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchWikiSlugs(keyword: string): Promise<string[]> {
    const slugified = slugify(keyword);
    if (!keyword.startsWith("[")) {
        return []; // ensure this is a wiki link. you typed "[" to trigger the autocomplete. this is the 2nd '['
    }
    if (keyword.startsWith("[@")) { // don't handle this.
        return [];
    }

    const response = await fetch(`/api/wiki/searchWikiSlugs?keyword=${slugified}`);

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchEventOrSongTagsBracketAt(keyword: string): Promise<string[]> {
    if (keyword.startsWith("[@")) {
        keyword = keyword.substring(2);
    }
    else {
        return [];
    }

    const response = await fetch(`/api/wiki/searchSongEvents?keyword=${keyword}`);

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const ret = await response.json();
    return ret;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchEventOrSongTagsAt(keyword: string): Promise<string[]> {
    // no prefix here.
    const response = await fetch(`/api/wiki/searchSongEvents?keyword=${keyword}`);

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const ret = await response.json();
    return ret;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MarkdownEditorProps {
    value: string | null, // value which may be coming from the database.
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
    height?: number,
    autoFocus?: boolean;
    displayUploadFileComponent?: boolean;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
    const [progress, setProgress] = React.useState<number | null>(null);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const ta = React.useRef<any>({});

    const maxImageDimension = 800;

    const setTa = (v) => {
        ta.current = v;
    };

    const style: React.CSSProperties = {
        minHeight: props.height || 400,
    };

    const insertTextAtCursor = (textToInsert) => {
        const textarea = ta.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = textarea.value.substring(0, start);
        const textAfter = textarea.value.substring(end, textarea.value.length);

        const newText = textBefore + textToInsert + textAfter;
        props.onValueChanged(newText);
    };

    // ok when you upload, the gallery item component is created.
    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            setProgress(0);
            CMDBUploadFile({
                fields: {
                    visiblePermission: Permission.visibility_public,
                },
                files,
                onProgress: (prog01, uploaded, total) => {
                    setProgress(prog01);
                },
                maxImageDimension,
            }).then((resp) => {
                setProgress(null);

                const toInsert = resp.files.map(f => {
                    const url = `/api/files/download/${f.storedLeafName}`; // relative url is fine.
                    const mimeInfo = parseMimeType(f.mimeType);
                    const isImage = mimeInfo?.type === 'image';
                    if (isImage) {
                        return `![${f.fileLeafName}](${url})`;
                    }
                    return `[${f.fileLeafName}](${url})`;
                }).join(" ");

                insertTextAtCursor(toInsert);

                if (!resp.isSuccess) {
                    throw new Error(`Server returned unsuccessful result while uploading files`);
                }
                showSnackbar({ severity: "success", children: `Uploaded file(s)` });
            }).catch((e: string) => {
                console.log(e);
                showSnackbar({ severity: "error", children: `error uploading file(s) : ${e}` });
            });
        }
    };

    const handlePaste = (e) => {
        if ((e.clipboardData?.files?.length || 0) > 0) {
            handleFileSelect(e.clipboardData!.files);
            e.preventDefault();
        }
    };

    return (<div className="FileUploadWrapperContainer">
        <FileDropWrapper
            className="frontpageGalleryFileUploadWrapper"
            onFileSelect={handleFileSelect}
            onURLUpload={() => { }}
            progress={progress}
        >
            <ReactTextareaAutocomplete
                containerClassName="editorContainer"
                loadingComponent={() => <div>Loading...</div>}
                autoFocus={!!props.autoFocus}
                //ref={rta => setRta(rta)}
                innerRef={textarea => setTa(textarea)}
                //movePopupAsYouType={true}
                value={props.value || ""}
                height={props.height || 400}
                style={style}
                onChange={(e) => {
                    props.onValueChanged(e.target.value);
                }}
                onPaste={handlePaste}
                minChar={3} // how many chars AFTER the trigger char you need to type before the popup arrives

                trigger={{
                    "[[": { // it's hard to understand how these triggers work; are these chars or strings??
                        dataProvider: token => fetchWikiSlugs(token),
                        // renders the item in the suggestion list.
                        component: ({ entity, selected }: { entity: string, selected: boolean }) => <div className={`autoCompleteCMLinkItem wiki ${selected ? "selected" : "notSelected"}`}>{entity}</div>,
                        output: (item: string) => `[[${item}]]`
                    },
                    "@": {
                        dataProvider: token => fetchEventOrSongTagsAt(token),
                        component: ({ entity, selected }: { entity: MatchingSlugItem, selected: boolean }) => <div className={`autoCompleteCMLinkItem ${entity.itemType} ${selected ? "selected" : "notSelected"}`}>
                            {entity.itemType === "event" && <CalendarMonthIcon />}
                            {entity.itemType === "song" && <MusicNoteIcon />}
                            {entity.itemType === "user" && <PersonIcon />}
                            {entity.itemType === "instrument" && <MusicNoteIcon />}
                            {entity.name}
                        </div>,
                        output: (item: MatchingSlugItem) => `[[${item.itemType}:${item.id}|${item.name}]]`
                    },
                }}
            />
            {(props.displayUploadFileComponent) && <CollapsableUploadFileComponent
                onFileSelect={handleFileSelect}
                enablePaste={false} // because paste is handled inline in the textarea.
                progress={progress}
            />}
        </FileDropWrapper>
    </div>
    );
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// must be uncontrolled because of the debouncing. if caller sets the value, then debounce is not possible. external / internal values are different.
// the "value" is used in a react.useEffect() so for isEqual() functionality just comply with that.

// this version allows complete control over rendering by passing a render function.
// another approach would allow rendering using a react context and child components. but meh that's more verbose and complex plumbing than this
export interface DebouncedControlCustomRenderArgs {
    isSaving: boolean;
    isDebouncing: boolean;
    value: any;
    onChange: (value: any) => void;
};

export interface DebouncedControlCustomRenderProps {
    initialValue: any, // value which may be coming from the database.
    onValueChanged: (value) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds?: number,
    render: (args: DebouncedControlCustomRenderArgs) => React.ReactElement,
}

// here we let callers completely customize rendering with nested callbacks.
// this calls props.onRender()
export function DebouncedControlCustomRender(props: DebouncedControlCustomRenderProps) {
    const [valueState, setValueState] = React.useState<string | null>(props.initialValue);
    const [firstUpdate, setFirstUpdate] = React.useState<boolean>(true);
    const [debouncedValue, { isDebouncing }] = useDebounce<string | null>(valueState, props.debounceMilliseconds || 1200); // 

    const saveNow = () => {
        if (firstUpdate && debouncedValue === props.initialValue) {
            setFirstUpdate(false);
            return; // avoid onchange when the control first loads and sets debounced state.
        }
        props.onValueChanged(debouncedValue);
    };

    React.useEffect(saveNow, [debouncedValue]);

    return props.render({
        isSaving: props.isSaving,
        isDebouncing,
        value: valueState,
        onChange: (value) => { setValueState(value) },
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// debounce control with default rendering (edit button, save progress)
interface DebouncedControlProps {
    initialValue: any, // value which may be coming from the database.
    onValueChanged: (value) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds?: number,
    className?: string,
    render: (showingEditor: boolean, value, onChange: (value) => void) => React.ReactElement,
    editButtonText?: string,
    helpText?: React.ReactNode,
    closeButtonText?: string,
}

export function DebouncedControl(props: DebouncedControlProps) {
    const [valueState, setValueState] = React.useState<string | null>(props.initialValue);
    const [debouncedValue, { isDebouncing, isFirstUpdate }] = useDebounce<string | null>(valueState, props.debounceMilliseconds || 1200); // 

    const saveNow = () => {
        if (isFirstUpdate) return;
        props.onValueChanged(debouncedValue);
    };

    React.useEffect(saveNow, [debouncedValue]);

    const onChange = (value) => {
        setValueState(value);
    };

    const [showingEditor, setShowingEditor] = React.useState<boolean>(false);

    const editButton = <Button startIcon={<EditIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >{props.editButtonText ?? "Edit"}</Button>;

    return (
        <div className={`${props.className} ${showingEditor ? "editMode" : ""}`}>
            <div className='editControlsContainer'>
                {!showingEditor && editButton}
                {showingEditor && <Button startIcon={<CloseIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >{props.closeButtonText ?? "Close"}</Button>}
                {props.isSaving ? (<><CircularProgress color="info" size="1rem" /> Saving ...</>) : (
                    isDebouncing ? (<><CircularProgress color="warning" size="1rem" /></>) : (
                        <></>
                    )
                )}
                {props.helpText && <div className="helpText">{props.helpText}</div>}
            </div>
            {props.render(showingEditor, valueState, onChange)}
        </div>
    );
}




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// must be uncontrolled because of the debouncing. if caller sets the value, then debounce is not possible.
interface MarkdownControlProps {
    initialValue: string | null, // value which may be coming from the database.
    className?: string;
    onValueChanged: (val: string | null) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds: number,
    editButtonText?: string,
    helpText?: React.ReactNode,
    closeButtonText?: string,
    readonly?: boolean,
}

export function MarkdownControl(props: MarkdownControlProps) {
    if (props.readonly) return <Markdown markdown={props.initialValue} />;
    return <DebouncedControl
        debounceMilliseconds={props.debounceMilliseconds}
        initialValue={props.initialValue}
        isSaving={props.isSaving}
        onValueChanged={props.onValueChanged}
        className={`richTextContainer editable ${props.className || ""}`}
        editButtonText={props.editButtonText}
        helpText={props.helpText}
        closeButtonText={props.closeButtonText}
        render={(showingEditor, value, onChange) => {
            return <div className='richTextContentContainer'>
                {showingEditor && <MarkdownEditor value={value} onValueChanged={onChange} />}
                <Markdown markdown={value} />
            </div>

        }}
    />;
}








// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NO DEBOUNCE behavior here.
interface CompactMarkdownControlProps {
    initialValue: string | null, // value which may be coming from the database.
    className?: string;
    onValueChanged: (val: string) => Promise<void>, // caller can save the changed value to a db here.
    cancelButtonMessage?: string,
    saveButtonMessage?: string,
    editButtonMessage?: string,
    editButtonVariant?: "framed" | "default";
    height?: number;
    readonly?: boolean;
    alwaysEditMode?: boolean; // avoid edit/save/cancel buttons; just make it always edit. useful for edit object dialogs
}

export function CompactMarkdownControl({ initialValue, onValueChanged, ...props }: CompactMarkdownControlProps) {
    const [showingEditor, setShowingEditor] = React.useState<boolean>(false);
    const [value, setValue] = React.useState<string>(initialValue || "");
    const alwaysEdit = CoerceToBoolean(props.alwaysEditMode, false);
    const showingEditor2 = !props.readonly && (showingEditor || alwaysEdit);

    const onCancel = () => {
        setValue(initialValue || "");
        setShowingEditor(false);
    };

    const onSave = () => {
        void onValueChanged(value).then(() => {
            setShowingEditor(false);
        });
    };

    if (showingEditor2) {
        return (<div className={`compactMarkdownControlRoot editing ${props.className}`}>
            <div className="CMSmallButtonGroup">
                {!alwaysEdit && <CMSmallButton variant={"framed"} onClick={() => onSave()}>{props.saveButtonMessage || "Save"}</CMSmallButton>}
                {!alwaysEdit && <CMSmallButton variant={"framed"} onClick={() => onCancel()}>{props.cancelButtonMessage || "Cancel"}</CMSmallButton>}
                <span className="helpText">
                    Markdown syntax is supported. <a href="/backstage/wiki/markdown-help" target="_blank">Click here</a> for details.
                </span>
            </div>
            <div className="richTextContainer compactMarkdownControl">
                <div className='richTextContentContainer'>
                    <MarkdownEditor value={value} onValueChanged={(v) => {
                        setValue(v);
                        if (alwaysEdit) {
                            void onValueChanged(v); // async throwaway
                        }
                    }} height={props.height || 50} />
                </div>
            </div>
            {value !== "" && <div className="tinyCaption">Preview:</div>}
            <Markdown markdown={value} />
        </div>);
    }

    // not editor just viewer.
    return <div className={`richTextContainer compactMarkdownControl notEditing ${props.readonly ? "readonly" : "editable interactable"} compactMarkdownControlRoot ${props.className}`} onClick={() => setShowingEditor(true)} >
        <Markdown markdown={value} className={props.className} />
        {!props.readonly && IsNullOrWhitespace(value) && <CMSmallButton variant={props.editButtonVariant} onClick={() => setShowingEditor(true)}>{props.editButtonMessage || "Edit"}</CMSmallButton>}
    </div >;
};

