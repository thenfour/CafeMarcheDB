
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
