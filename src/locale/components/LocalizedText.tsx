import { Markdown } from "src/core/components/markdown/Markdown";
import type { LocalizedMarkdownKey, LocalizedPlainStringKey, StaticStringParameterProps, StaticStringParameters } from "../shared/staticLocalizedStringRegistry";
import { useLocale } from "./useLocale";

type TextProps<K extends LocalizedPlainStringKey> = { stringKey: K } & StaticStringParameterProps<K>;

export function LocalizedText<K extends LocalizedPlainStringKey>(props: TextProps<K>) {
    const locale = useLocale();
    // Generic JSX props keep the key/parameter relationship, but TS cannot narrow its conditional tuple.
    const getter = locale.getPlainString as (key: K, parameters?: StaticStringParameters<K>) => string;
    return <>{getter(props.stringKey, props.parameters)}</>;
}

export function LocalizedMarkdownText({ stringKey }: { stringKey: LocalizedMarkdownKey }) {
    return <Markdown markdown={useLocale().getMarkdownString(stringKey)} />;
}
