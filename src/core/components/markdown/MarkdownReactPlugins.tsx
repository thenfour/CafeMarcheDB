// <Markdown> = rendered markdown text (simple read only html)
// <MarkdownEditor> = just the text editor which outputs markdown
// <MarkdownControl> = full editor with debounced commitment (caller actually commits), displays saving indicator, switch between edit/view

// syntax updates:
// ```abc
// ```

// inline ABC:
// {{abc:...}}

// rehearsal mark:
// {{enclosed:...}}

// references?
// wiki, song, event, ...?

// image dimensions

import "@webscopeio/react-textarea-autocomplete/style.css";
import 'abcjs/abcjs-audio.css';
import React from "react";
import { ABCReactPlugin } from './ABCReactPlugin';


interface MarkdownReactPlugin {
    componentName: string;
    render: (node: Element, componentName: string, propsString: string) => React.ReactNode;
};

const RenderMarkdownSpanWithClass = (node: Element, componentName: string, propsString: string) => {
    return <span className={`markdown-class-${componentName}`}>{propsString}</span>
};

const spanClasses = [
    "big",
    "bigger",
    "highlight",
    "highlightred",
    "highlightblue",
    "highlightgreen",
    "enclosed",
] as const;

export const markdownReactPlugins: MarkdownReactPlugin[] = [
    ...spanClasses.map(className => ({
        componentName: className,
        render: RenderMarkdownSpanWithClass,
    })),
    {
        componentName: "abc",
        render: ABCReactPlugin
    }
];


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export async function fetchInlineClasses(keyword: string): Promise<string[]> {
    if (keyword.includes("}}")) return []; // make sure we don't autocomplete outside of the link syntax
    if (!keyword.startsWith("{")) {
        return []; // ensure this is a wiki link. you typed "[" to trigger the autocomplete. this is the 2nd '['
    }
    const ret = [
        ...spanClasses,
        "abc",
    ].filter(x => x.toLowerCase().includes(keyword.slice(1).toLowerCase()));
    return ret;
}
