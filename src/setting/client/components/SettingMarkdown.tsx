import React from "react";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedMarkdownKey } from "src/locale/shared/staticLocalizedStringRegistry";

interface LocalizedMarkdownProps {
    setting: LocalizedMarkdownKey;
    fallbackWhen?: "null" | "emptyString" | "nullOrEmptyString";
    fallbackMarkdown?: string | null;
}

// Scoped localized editing replaces the retired Setting writer in phase 6.
export const LocalizedMarkdown = (props: LocalizedMarkdownProps) => {
    const locale = useLocale();
    let text = locale.getStringDetail(props.setting).value;
    const fallbackWhen = props.fallbackWhen ?? "null";
    const missing = text === null;
    const empty = text !== null && text.trim() === "";
    if (props.fallbackMarkdown !== undefined && (fallbackWhen === "null" && missing
        || fallbackWhen === "emptyString" && empty || fallbackWhen === "nullOrEmptyString" && (missing || empty))) {
        text = props.fallbackMarkdown;
    }
    return <div className="settingMarkdownContainer"><Markdown markdown={text} /></div>;
};
