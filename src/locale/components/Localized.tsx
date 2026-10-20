import React from "react";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedStringIdAndParams } from "../shared/localizationCatalog";
import type { LocalizedPlainStringKey } from "../shared/staticLocalizedStringRegistry";

type LocalizedProps =
    | LocalizedStringIdAndParams<LocalizedPlainStringKey> & {
        component?: React.ElementType | null;
        style?: React.CSSProperties | null;
        className?: string | null;
    }
    // Any key can be forwarded without a wrapper; only plain text accepts a component.
    | LocalizedStringIdAndParams & {
        component?: never;
        style?: never;
        className?: string | null;
    };

export function Localized(props: LocalizedProps) {
    const locale = useLocale();
    const string = locale.getString(props);
    if (string.format === "markdown") {
        return <Markdown markdown={string.value} className={props.className ?? undefined} />;
    }
    if (props.component) {
        const Component = props.component;
        return <Component style={props.style} className={props.className}>{string.value}</Component>;
    }
    return <>{string.value}</>;
}
