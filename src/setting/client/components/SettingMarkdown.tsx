import React from "react";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import { kStaticLocalizedStringRegistry, type StaticLocalizedStringKey, type StaticStringParameterProps } from "src/locale/shared/staticLocalizedStringRegistry";
export { BandLocalizedMarkdown, LocalizedMarkdown } from "src/locale/components/LocalizedMarkdown";

const resolveStringWithFallback = (str: string | null, fallbackWhen: "null" | "emptyString" | "nullOrEmptyString", fallback: string | null) => {
    const missing = str === null;
    const empty = str !== null && str.trim() === "";
    if (fallback !== undefined && (fallbackWhen === "null" && missing
        || fallbackWhen === "emptyString" && empty || fallbackWhen === "nullOrEmptyString" && (missing || empty))) {
        return { text: fallback, isFallback: true };
    }
    return { text: str, isFallback: false };
};

interface LocalizedPresentationProps {
    fallbackWhen?: "null" | "emptyString" | "nullOrEmptyString";
    fallbackPlainString?: string | null;

    component?: React.ElementType | null; // null will use React.Fragment

    // for element component types
    style?: React.CSSProperties | null;
    className?: string | null;
}

type LocalizedProps = LocalizedPresentationProps & {
    [K in StaticLocalizedStringKey]: { id: K } & StaticStringParameterProps<K>;
}[StaticLocalizedStringKey];

export function Localized({ id, parameters, style, className, fallbackWhen = "null", fallbackPlainString = null, component = null }: LocalizedProps) {
    const locale = useLocale();
    const detail = locale.getStringDetail(id);
    const { text, isFallback } = resolveStringWithFallback(detail.value, fallbackWhen, fallbackPlainString);
    if (text === null) {
        return null;
    }
    const format = kStaticLocalizedStringRegistry[id].format;
    // Props enforce the key/parameter pair; TS cannot narrow it through registry metadata.
    const getPlainString = locale.getPlainString as (key: StaticLocalizedStringKey, parameters: LocalizedProps["parameters"]) => string;
    const content = format === "plain" && !isFallback ? getPlainString(id, parameters) : text;
    if (component !== null) {
        const Component = component;
        return <Component style={style} className={className}>{content}</Component>;
    }
    if (format === "markdown") {
        return <Markdown markdown={content} />;
    }
    return <>{content}</>;
}
