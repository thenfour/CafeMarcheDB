//'use client'

// <Markdown> = rendered markdown text (simple read only html)
// <MarkdownEditor> = just the text editor which outputs markdown
// <MarkdownControl> = full editor with debounced commitment (caller actually commits), displays saving indicator, switch between edit/view

// todo: autocomplete routes (events, songs) [[]]
// todo: autocomplete mentions
// todo: paste attachments
// todo: drop attachments

// import {
//     DeleteOutlined as DeleteIcon,
//     Edit as EditIcon
// } from '@mui/icons-material';
import { Button, CircularProgress, Tooltip } from "@mui/material";
import MarkdownIt from 'markdown-it';
import React from "react";
//import useDebounce from "shared/useDebounce";
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import "@webscopeio/react-textarea-autocomplete/style.css";
import { useDebounce } from "shared/useDebounce";
import { CMSmallButton } from "./CMCoreComponents2";
import { CoerceToBoolean } from "shared/utils";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const Markdown = (props: { markdown: string | null, id?: string, className?: string, compact?: boolean }) => {
    const md = new MarkdownIt;
    if (props.markdown == null) return <></>;
    if (props.markdown.trim().length < 1) return <></>;
    return <div className={`markdown renderedContent limitedWidth ${props.compact && "compact"} ${props.className || ""}`}>
        <div id={props.id} dangerouslySetInnerHTML={{ __html: md.render(props.markdown || "") }}></div>
    </div >;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MarkdownEditorProps {
    value: string | null, // value which may be coming from the database.
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
    height?: number,
    autoFocus?: boolean;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
    const Item = ({ entity: { name, char } }) => <div>{`${name}: ${char}`}</div>;
    const Loading = ({ data }) => <div>Loading</div>;

    const style: React.CSSProperties = {
        minHeight: props.height || 400,
    };

    return (
        <ReactTextareaAutocomplete
            containerClassName="editorContainer"
            loadingComponent={Loading}
            autoFocus={!!props.autoFocus}
            //ref={rta => setRta(rta)}
            //innerRef={textarea => setTa(textarea)}
            containerStyle={{
                //marginTop: 20,
            }}
            //movePopupAsYouType={true}
            value={props.value || ""}
            height={props.height || 400}
            style={style}
            onChange={(e) => {
                props.onValueChanged(e.target.value);
            }}
            minChar={0} // how many chars AFTER the trigger char you need to type before the popup arrives
            trigger={{
                "@": {
                    dataProvider: token => {
                        return [
                            { name: "smile", char: "🙂" },
                            { name: "heart", char: "❤️" }
                        ];
                    },
                    component: Item,
                    output: (item, trigger) => item.char
                }
            }}
        />
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
                {!alwaysEdit && <CMSmallButton variant={"framed"} onClick={() => onCancel()}>{props.cancelButtonMessage || "Cancel"}</CMSmallButton>}
                {!alwaysEdit && <CMSmallButton variant={"framed"} onClick={() => onSave()}>{props.saveButtonMessage || "Save"}</CMSmallButton>}
                <span className="helpText">
                    Markdown syntax is supported. <a href="/backstage/markdownhelp" target="_blank">Click here</a> for details.
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
    return <div className={`richTextContainer compactMarkdownControl notEditing sameLineButton compactMarkdownControlRoot ${props.className}`}>
        <Markdown markdown={value} className={props.className} />
        {!props.readonly && <CMSmallButton variant={props.editButtonVariant} onClick={() => setShowingEditor(true)}>{props.editButtonMessage || "Edit"}</CMSmallButton>}
    </div >;
};
