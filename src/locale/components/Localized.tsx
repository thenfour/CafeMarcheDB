import React from "react";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedStringIdAndParams } from "../shared/localizationCatalog";
import type { LocalizedPlainStringKey } from "../shared/staticLocalizedStringRegistry";

type LocalizedOwnedProp = "id" | "parameters" | "component" | "children" | "dangerouslySetInnerHTML" | "data-localized-string-key";

// Distribute over component prop unions so their required combinations stay intact.
type LocalizedComponentProps<C extends React.ElementType, P = React.ComponentPropsWithoutRef<C>> =
    P extends unknown ? Omit<P, LocalizedOwnedProp> & { children?: never; dangerouslySetInnerHTML?: never } : never;

type DefaultLocalizedProps =
    | LocalizedStringIdAndParams<LocalizedPlainStringKey> & LocalizedComponentProps<"span"> & { component?: null }
    // A forwarded key may be plain text or Markdown; only their shared options are available.
    | LocalizedStringIdAndParams & { component?: never; style?: never; className?: string | null; children?: never; dangerouslySetInnerHTML?: never };

type LocalizedImplementationProps = LocalizedStringIdAndParams & {
    component?: React.ElementType | null;
    style?: React.CSSProperties | null;
    className?: string | null;
};

// Infer the root only from component; other props must conform to that root.
export function Localized<C extends React.ElementType>(props: LocalizedStringIdAndParams<LocalizedPlainStringKey>
    & { component: C } & LocalizedComponentProps<NoInfer<C>>): React.ReactElement;
export function Localized(props: DefaultLocalizedProps): React.ReactElement;
export function Localized(props: LocalizedImplementationProps): React.ReactElement {
    const locale = useLocale();
    const string = locale.getString(props);
    const { id, parameters, component, className, style, ...componentProps } = props;
    if (string.format === "markdown") {
        return <Markdown markdown={string.value} className={className ?? undefined}
            containerProps={{ "data-localized-string-key": id }} />;
    }
    const Component = component ?? "span";
    return <Component {...componentProps} style={style ?? undefined} className={className ?? undefined}
        data-localized-string-key={id}>{string.value}</Component>;
}
