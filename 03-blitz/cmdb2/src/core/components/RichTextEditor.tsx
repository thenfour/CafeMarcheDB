//'use client'

// ok we're close. now there's a sequence of events creating a flicker
// debounce starts, we use an internal value.
// debounce stops, now we use the passed in value (which is not correct)
// so there needs to be many intermediate steps, between both the text editor and the caller.
// better to just make it uncontrolled, so what the user sees is ALWAYS correct.

import React, { Suspense } from "react";
import { Box, Button, ButtonGroup, CircularProgress, IconButton, LinearProgress, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import MarkdownIt from 'markdown-it';
import useDebounce from "shared/useDebounce";
import {
    Add as AddIcon,
    Close as CancelIcon,
    DeleteOutlined as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon
} from '@mui/icons-material';

interface RichTextEditorProps {
    initialValue: string, // value which may be coming from the database.
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds: number,
}

// we will control the value, but callers must treat as uncontrolled.
interface RichTextEditorValueState {
    markdown: string,
    html: string,
}

function MarkdownToHTML(md: any, value: string): string {
    return md.render(value);
}


export default function RichTextEditor(props: RichTextEditorProps) {
    const [md, setMd] = React.useState<any>(null);
    const [valueState, setValueState] = React.useState<RichTextEditorValueState>({
        markdown: "",
        html: "",
    });

    const [isDebouncing, setIsDebouncing] = React.useState<boolean>(false);
    const debouncedMarkdown = useDebounce<string>(valueState.markdown, props.debounceMilliseconds); // 

    React.useEffect(() => {
        const md2 = new MarkdownIt;
        setMd(md2);
        setValueState({
            markdown: props.initialValue,
            html: md2.render(props.initialValue),
        });
    }, []);

    // when debounced value changes, tell caller to commit.
    React.useEffect(() => {
        setIsDebouncing(false);
        if (props.onValueChanged) props.onValueChanged(debouncedMarkdown);
    }, [debouncedMarkdown]);

    // raw onchange; set internal state for temp use while debouncing
    const onChange = (e) => {
        const newval = e.target.value;
        setIsDebouncing(true);
        console.assert(!!md);
        setValueState({
            markdown: newval,
            html: md.render(newval),
        });
    };

    const [showingEditor, setShowingEditor] = React.useState<boolean>(false);

    return (
        <Box sx={{ border: 2 }}>

            <ButtonGroup variant="outlined" size="small" aria-label="outlined primary button group">
                <Button startIcon={<EditIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >Edit</Button>
                <Button startIcon={<DeleteIcon />}>Delete</Button>
            </ButtonGroup>
            {props.isSaving ? (<LinearProgress color="info" sx={{ width: 25 }} />) : (
                isDebouncing ? (<LinearProgress color="warning" sx={{ width: 25 }} />) : (
                    <LinearProgress variant="determinate" value={100} color="success" sx={{ width: 25 }} />
                )
            )}

            {showingEditor && (<>
                <Box sx={{ p: 0 }}>
                    <TextField sx={{ width: "100%" }} multiline={true} value={valueState.markdown} onChange={onChange} variant="filled"></TextField>
                </Box>
            </>
            )}
            <Box sx={{ p: 0 }}>
                <div dangerouslySetInnerHTML={{ __html: valueState.html }}></div>


            </Box >

        </Box>
    );
}

