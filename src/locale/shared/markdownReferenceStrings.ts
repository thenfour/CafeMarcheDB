import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Markdown reference editor", schema: z.string() });

export const markdownReferenceStrings = {
    "markdown.reference.mentionTooltip": label("Link to song / event / person (Ctrl+M)"),
    "markdown.reference.mentionTitle": label("Insert reference to songs, events, etc..."),
    "markdown.reference.wikiTooltip": label("Wiki link (Ctrl+J)"),
    "markdown.reference.wikiTitle": label("Insert reference to Wiki article"),
    "markdown.reference.wikiLink": label("Wiki link"),
    "markdown.reference.item": label("Item"),
    "markdown.reference.caption": label("Custom caption (optional)"),
    "markdown.reference.search": label("Search..."),
    "markdown.reference.loading": label("Loading..."),
};
