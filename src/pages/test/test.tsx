import { BlitzPage } from "@blitzjs/next";
import { NoSsr } from "@mui/material";
import Head from "next/head";
import * as React from 'react';
import { CMTextInputBase } from "src/core/components/CMTextField";
import { Markdown } from "src/core/components/RichTextEditor";

const MainContent = () => {
    const [text, setText] = React.useState("# here i am");
    const [pluginEnable, setPluginEnable] = React.useState(0);
    return <div>
        <h1>test.</h1>
        <div className="btn" onClick={() => setPluginEnable(pluginEnable ^ 1)}>1 {pluginEnable & 1 ? "enabled" : "disabled"}</div>
        <div className="btn" onClick={() => setPluginEnable(pluginEnable ^ 2)}>2 {pluginEnable & 2 ? "enabled" : "disabled"}</div>
        <div className="btn" onClick={() => setPluginEnable(pluginEnable ^ 4)}>4 {pluginEnable & 4 ? "enabled" : "disabled"}</div>
        <div className="btn" onClick={() => setPluginEnable(pluginEnable ^ 8)}>8 {pluginEnable & 8 ? "enabled" : "disabled"}</div>
        <CMTextInputBase value={text} onChange={(e, v) => setText(v)} />
        <Markdown markdown={text} pluginEnable={pluginEnable} />
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

