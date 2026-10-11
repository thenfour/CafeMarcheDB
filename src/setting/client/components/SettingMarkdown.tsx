import React from "react";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import { type StaticLocalizedStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
export { BandLocalizedMarkdown, LocalizedMarkdown } from "src/locale/components/LocalizedMarkdown";

const resolveStringWithFallback = (str: string | null, fallbackWhen: "null" | "emptyString" | "nullOrEmptyString", fallback: string | null) => {
    const missing = str === null;
    const empty = str !== null && str.trim() === "";
    if (fallback !== undefined && (fallbackWhen === "null" && missing
        || fallbackWhen === "emptyString" && empty || fallbackWhen === "nullOrEmptyString" && (missing || empty))) {
        return fallback;
    }
    return str;
};

interface LocalizedProps {
    id: StaticLocalizedStringKey;
    fallbackWhen?: "null" | "emptyString" | "nullOrEmptyString";
    fallbackPlainString?: string | null;

    component?: React.ElementType | null; // null will use React.Fragment

    // for element component types
    style?: React.CSSProperties | null;
    className?: string | null;
}

export const Localized = ({ id, style, className, fallbackWhen = "null", fallbackPlainString = null, component = null }: LocalizedProps) => {
    const locale = useLocale();
    const str = locale.getString(id);
    const text = resolveStringWithFallback(str.value, fallbackWhen, fallbackPlainString);
    if (text === null) {
        return null;
    }

    if (component === null) { // use react.fragment.
        if (str.format === "plain") {
            return <>{text}</>;
        }
        if (str.format === "markdown") {
            return <Markdown markdown={text} />;
        }
        throw new Error(`Unsupported string format on key ${id}: ${str.format}`);
    }

    const Component = component;

    if (str.format === "plain") {
        return <Component style={style} className={className}>{text}</Component>;
    }
    if (str.format === "markdown") {
        return <Component style={style} className={className}>{text}</Component>;
    }
    throw new Error(`Unsupported string format on key ${id}: ${str.format}`);
};
