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
import { Box, Button, ButtonGroup, CircularProgress, TextField } from "@mui/material";
import MarkdownIt from 'markdown-it';
import React from "react";
//import useDebounce from "shared/useDebounce";
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import "@webscopeio/react-textarea-autocomplete/style.css";
import { useDebounce } from "shared/useDebounce";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const Markdown = (props: { markdown: string | null }) => {
    const md = new MarkdownIt;
    return <div className='renderedContent'>
        <div dangerouslySetInnerHTML={{ __html: md.render(props.markdown || "") }}></div>
    </div >;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MarkdownEditorProps {
    value: string | null, // value which may be coming from the database.
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
}

export function MarkdownEditor(props: MarkdownEditorProps) {
    const Item = ({ entity: { name, char } }) => <div>{`${name}: ${char}`}</div>;
    const Loading = ({ data }) => <div>Loading</div>;

    return (
        <ReactTextareaAutocomplete
            containerClassName="editorContainer"
            loadingComponent={Loading}
            //ref={rta => setRta(rta)}
            //innerRef={textarea => setTa(textarea)}
            containerStyle={{
                //marginTop: 20,
            }}
            //movePopupAsYouType={true}
            value={props.value || ""}
            height={400}
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
}

export function DebouncedControl(props: DebouncedControlProps) {
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

    const onChange = (value) => {
        setValueState(value);
    };

    const [showingEditor, setShowingEditor] = React.useState<boolean>(false);

    return (
        <div className={`${props.className} ${showingEditor ? "editMode" : ""}`}>
            <div className='editControlsContainer'>
                {!showingEditor && <Button startIcon={<EditIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >Edit</Button>}
                {showingEditor && <Button startIcon={<CloseIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >Close</Button>}
                {props.isSaving ? (<><CircularProgress color="info" size="1rem" /> Saving ...</>) : (
                    isDebouncing ? (<><CircularProgress color="warning" size="1rem" /></>) : (
                        <></>
                    )
                )}
            </div>
            {props.render(showingEditor, valueState, onChange)}
        </div>
    );
}




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// must be uncontrolled because of the debouncing. if caller sets the value, then debounce is not possible.
interface MarkdownControlProps {
    initialValue: string | null, // value which may be coming from the database.
    onValueChanged: (val: string | null) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds: number,
}

export function MarkdownControl(props: MarkdownControlProps) {
    return <DebouncedControl
        debounceMilliseconds={props.debounceMilliseconds}
        initialValue={props.initialValue}
        isSaving={props.isSaving}
        onValueChanged={props.onValueChanged}
        className="richTextContainer"
        render={(showingEditor, value, onChange) => {
            return <div className='richTextContentContainer'>
                {showingEditor && <MarkdownEditor value={value} onValueChanged={onChange} />}
                <Markdown markdown={value} />
            </div>

        }}
    />;
}








////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// must be uncontrolled because of the debouncing. if caller sets the value, then debounce is not possible.
// similar to the "normal" markdown control
// but
// - single-line
// - no preview
// - tiny edit button next to value
interface CompactMarkdownControlProps {
    initialValue: string | null, // value which may be coming from the database.
    onValueChanged: (val: string | null) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds: number,
}

export function CompactMarkdownControl(props: CompactMarkdownControlProps) {
    return <DebouncedControl
        debounceMilliseconds={props.debounceMilliseconds}
        initialValue={props.initialValue}
        isSaving={props.isSaving}
        onValueChanged={props.onValueChanged}
        className="richTextContainer compactMarkdownControl"
        render={(showingEditor, value, onChange) => {
            return <div className='richTextContentContainer'>
                {showingEditor && <MarkdownEditor value={value} onValueChanged={onChange} />}
                <Markdown markdown={value} />
            </div>

        }}
    />;
};