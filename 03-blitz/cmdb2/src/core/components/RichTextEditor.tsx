'use client'

import React, { Suspense } from "react";
import dynamic from "next/dynamic";

import 'react-quill/dist/quill.snow.css'
import { Box, Tab, Tabs, Typography } from "@mui/material";
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false, suspense: true });



interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}


function a11yProps(index: number) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

export default function RichTextEditor() {
    const [value, setValue] = React.useState<String>('aoesunth');
    const [tab, setTab] = React.useState<Number>(0);
    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
    };
    return (
        <>
            <Tabs value={tab} onChange={handleChange} aria-label="basic tabs example">
                <Tab label="Item One" {...a11yProps(0)} />
                <Tab label="Item Two" {...a11yProps(1)} />
                <Tab label="Item Three" {...a11yProps(2)} />
            </Tabs>
            <CustomTabPanel index={0} value={tab}>
                <Suspense fallback="Loading...">
                    <ReactQuill value={value} onChange={(v) => {
                        console.log(v);
                        setValue(v);
                    }} />
                </Suspense>
            </CustomTabPanel>
            <CustomTabPanel index={1} value={tab}>
                <div dangerouslySetInnerHTML={{ __html: value }} />
            </CustomTabPanel>
            <CustomTabPanel index={2} value={tab}>
                <>2</>
            </CustomTabPanel>
        </>
    );
}