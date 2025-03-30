
import React from "react";

interface MarkdownReactPlugin {
    componentName: string;
    render: (node: Element, componentName: string, propsString: string) => React.ReactNode;
};

const RenderMarkdownSpanWithClass = (node: Element, componentName: string, propsString: string) => {
    return <span className={`markdown-class-${componentName}`}>{propsString}</span>
};

const spanClasses = [
    "small",
    "smaller",
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
];


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export async function fetchInlineClasses(keyword: string): Promise<string[]> {
    if (keyword.includes("}}")) return []; // make sure we don't autocomplete outside of the link syntax
    if (!keyword.startsWith("{")) {
        return []; // ensure this is a wiki link. you typed "[" to trigger the autocomplete. this is the 2nd '['
    }
    const ret = [
        ...spanClasses,
    ].filter(x => x.toLowerCase().includes(keyword.slice(1).toLowerCase()));
    return ret;
}
