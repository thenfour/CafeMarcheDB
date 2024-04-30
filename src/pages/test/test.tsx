import { BlitzPage } from "@blitzjs/next";
import { NoSsr } from "@mui/material";
import Head from "next/head";
import * as React from 'react';
import { CMTextInputBase } from "src/core/components/CMTextField";

const MainContent = () => {
    const [text, setText] = React.useState("# here i am");
    return <div>
        <h1>test.</h1>
        <CMTextInputBase value={text} onChange={(e, v) => setText(v)} />
    </div>;
};

const Test1PublicIndex: BlitzPage = () => {
    return <>
        <Head>
            <title>test</title>
            <meta charSet="utf-8" />
            <style>{`
                .btn {
                    width:120px;
                    background-color: #ccc;
                    border-radius:8px;
                    border:2px solid black;
                    margin:4px 10px;
                    padding:4px 8px;
                }

                `}
            </style>
        </Head>
        <NoSsr>
            <MainContent />
        </NoSsr>

    </>;
}

export default Test1PublicIndex;

