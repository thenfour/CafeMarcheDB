//'use client'

// ok we're close. now there's a sequence of events creating a flicker
// debounce starts, we use an internal value.
// debounce stops, now we use the passed in value (which is not correct)

import React, { Suspense } from "react";
import { Box, CircularProgress, Tab, Tabs, TextField, Typography } from "@mui/material";
//import { MuiMarkdown } from 'mui-markdown';
import MarkdownIt from 'markdown-it';
import useDebounce from "shared/useDebounce";


// interface TabPanelProps {
//     children?: React.ReactNode;
//     index: number;
//     value: number;
// }

// function CustomTabPanel(props: TabPanelProps) {
//     const { children, value, index, ...other } = props;

//     return (
//         <div
//             role="tabpanel"
//             hidden={value !== index}
//             id={`simple-tabpanel-${index}`}
//             aria-labelledby={`simple-tab-${index}`}
//             {...other}
//         >
//             {value === index && (
//                 <Box >
//                     {children}
//                 </Box>
//             )}
//         </div>
//     );
// }


// function a11yProps(index: number) {
//     return {
//         id: `simple-tab-${index}`,
//         'aria-controls': `simple-tabpanel-${index}`,
//     };
// }

// interface DebounceArgs {
//     fn: (any) => any,
//     milliseconds: number,
// };

// const Debounce = (args: DebounceArgs) => {
//     let timeoutId;
//     return function (...innerArgs) {
//         clearTimeout(timeoutId);
//         timeoutId = setTimeout(() => {
//             args.fn.apply(this, innerArgs);
//         }, args.milliseconds);
//     };
// }

interface RichTextEditorProps {
    value: string, // value which may be stored in the database.
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
    saved: boolean, // indicate whether the value is saved or not to the db.
    debounceMilliseconds: number,
}

export default function RichTextEditor(props: RichTextEditorProps) {
    const [nonDebouncedValue, setNonDebouncedValue] = React.useState<string>("");
    //const [tab, setTab] = React.useState<Number>(0);
    // const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    //     setTab(newValue);
    // };

    const [isDebouncing, setIsDebouncing] = React.useState<boolean>(false);
    const debouncedValue = useDebounce<string>(nonDebouncedValue || "", props.debounceMilliseconds); // 

    // when debounced value changes, tell caller to commit.
    React.useEffect(() => {
        setIsDebouncing(false);
        if (props.onValueChanged) {
            //console.log(`debounce complete; val=${debouncedValue}. calling caller.onValueChanged`);
            props.onValueChanged(debouncedValue);
        }
        //console.log(`value committed: ${debouncedValue}`);
    }, [debouncedValue]);

    // raw onchange; set internal state for temp use while debouncing
    const onChange = (e) => {
        const newval = e.target.value;
        setIsDebouncing(true);
        setNonDebouncedValue(newval);
        //console.log(`raw value change in text editor. isDebouncing=true, nondebouncedvalue=${newval}`);
    };

    const value = (isDebouncing ? nonDebouncedValue : props.value) || "";

    const [html, setHtml] = React.useState<string>();

    // make html track value
    const [md] = React.useState(new MarkdownIt());
    React.useEffect(() => {
        setHtml(md.render(value));
    }, [value]);

    const isDirty = isDebouncing || !props.saved;

    //console.log(`text editor rendering with value:(${value})`);

    return (
        <>
            {/* <Suspense fallback="loading..."> */}
            <Box sx={{ height: 40 }}>
                {isDirty ? (<CircularProgress size={24} />) : (<>up to date.</>)}
            </Box>
            <Box>
                <TextField sx={{ width: "100%" }} multiline={true} value={value} onChange={onChange} variant="filled"></TextField>
            </Box>
            <Box sx={{ border: 3 }}>
                <div dangerouslySetInnerHTML={{ __html: html }}></div>
            </Box >
            {/* </Suspense> */}


            {/* <Tabs value={tab} onChange={handleChange} aria-label="basic tabs example">
                <Tab label="Edit" {...a11yProps(0)} />
                <Tab label="Preview" {...a11yProps(1)} />
                <Tab label="Both" {...a11yProps(2)} />
            </Tabs>
            <CustomTabPanel index={0} value={tab}>
                <Box>
                    <TextField sx={{ width: "100%" }} multiline={true} value={value} onChange={e => setValue(e.target.value)}></TextField>
                </Box>
            </CustomTabPanel>
            <CustomTabPanel index={1} value={tab}>
                <Box sx={{ border: 1 }}>
                    <MuiMarkdown>{value}</MuiMarkdown>
                </Box>
            </CustomTabPanel>
            <CustomTabPanel index={2} value={tab}>
                <Box>
                    <TextField sx={{ width: "100%" }} multiline={true} value={value} onChange={e => setValue(e.target.value)}></TextField>
                </Box>
                <Box sx={{ border: 1 }}>
                    <MuiMarkdown>{value}</MuiMarkdown>
                </Box>
            </CustomTabPanel> */}
        </>
    );
}

