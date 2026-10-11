import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({
    defaultValue, description: "Localized Markdown editor label or feedback", schema: z.string(),
});

export const localizedMarkdownStrings = {
    "localizedMarkdown.edit": label("Edit text"),
    "localizedMarkdown.locale": label("Editing language"),
    "localizedMarkdown.save": label("Save"),
    "localizedMarkdown.saveAndClose": label("Save and close"),
    "localizedMarkdown.inherit": label("Use inherited content"),
    "localizedMarkdown.keepOverride": label("Keep this language's text"),
    "localizedMarkdown.resetNotice": label("Saving will remove the text in this language and use inherited content."),
    "localizedMarkdown.missing": label("No saved text in this language. Saving an empty draft creates an intentional blank."),
    "localizedMarkdown.stored": label("Saved text in this language"),
    "localizedMarkdown.loading": label("Loading saved text…"),
    "localizedMarkdown.unavailable": label("Text editing is unavailable in this scope."),
    "localizedMarkdown.loadFailed": label("Saved text could not be loaded."),
    "localizedMarkdown.retry": label("Retry"),
    "localizedMarkdown.saved": label("Text saved."),
    "localizedMarkdown.failed": label("Text could not be saved. Your draft is retained."),
    "localizedMarkdown.refreshFailed": label("Text was saved, but the display could not be refreshed."),
};
