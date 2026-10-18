import React from "react";
import { CMChip, CMChipProps, CMChipShapeOptions, CMChipSizeOptions } from "../CMChip";
import { StandardVariationSpec } from "../color/palette";
import { SplitQuickFilter } from "@/shared/quickFilter";
import { ChoiceControl, ChoiceControlProps } from "../ChoiceControl";

export enum CMSelectNullBehavior {
    NonNullable = "NonNullable",
    AllowNull = "AllowNull",
    AllowUndefined = "AllowUndefined",
}

export interface SelectionQuery<T> {
    items: T[];
    isLoading?: boolean;
    isFetching?: boolean;
    isError?: boolean;
    isPreviousData?: boolean;
    hasMatches?: boolean;
    refetch: () => void;
    createOption?: (text: string) => Promise<T>;
    creationControls?: React.ReactNode;
}

export interface SelectionChoiceProps<T> extends Pick<ChoiceControlProps, "selected" | "disabled" | "label" | "interaction"> {
    readonly item: T;
}

export function getSelectionChipProps<T>(choice: SelectionChoiceProps<T>): Pick<CMChipProps, "variation" | "choice"> {
    return {
        // Actions keep the summary appearance; checked styling belongs to selection choices.
        variation: { ...StandardVariationSpec.Strong, selected: choice.interaction?.kind !== "action" && choice.selected, enabled: !choice.disabled },
        choice: { label: choice.label, interaction: choice.interaction },
    };
}

// Query hooks stay in the adapter. The picker owns interaction, never database rules.
export interface SelectionSource<T> {
    useOptions: (filterText: string, enabled: boolean) => SelectionQuery<T>;
    getKey: (item: T) => React.Key;
    getLabel: (item: T) => string;  // useful at  very least for filtering
    renderValue: (item: T) => React.ReactNode;
    renderChoice: (props: SelectionChoiceProps<T>) => React.ReactNode;
    renderOption?: (item: T, selected: boolean) => React.ReactNode;
    matchesText?: (item: T, text: string) => boolean;
}

function filterSelectionItems<T>(items: T[], getLabel: (item: T) => string, filterText: string): T[] {
    const words = SplitQuickFilter(filterText);
    return items.filter(item => words.every(word => getLabel(item).toLocaleLowerCase().includes(word)));
}

// Already-loaded choices can keep their domain rendering without another chip wrapper.
export function makeLocalSelectionSource<T>({ items, renderChoice, ...source }: Omit<SelectionSource<T>, "useOptions" | "renderChoice"> & {
    items: T[];
    renderChoice?: SelectionSource<T>["renderChoice"];
}): SelectionSource<T> {
    return {
        ...source,
        // Local content uses a native choice control unless the caller supplies a complete item renderer.
        renderChoice: renderChoice ?? (choice => <ChoiceControl {...choice}>{source.renderValue(choice.item)}</ChoiceControl>),
        useOptions: filterText => ({ items: filterSelectionItems(items, source.getLabel, filterText), refetch: () => { } }),
    };
}

export interface SelectionItemInfo {
    id: string | number;
    name?: string;
    color?: CMChipProps["color"];
    tooltip?: string | null;
}

export interface AsyncSelectionProps<T> {
    getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
    getOptionInfo: (item: T) => SelectionItemInfo;
    renderOption: (item: T) => React.ReactNode;
    renderChoice?: (props: SelectionChoiceProps<T>) => React.ReactNode;
    chipSize?: CMChipSizeOptions;
    chipShape?: CMChipShapeOptions;
    allowInsertFromString?: boolean;
    doesItemExactlyMatchText?: (item: T, text: string) => boolean;
    doInsertFromString?: (text: string) => Promise<T>;
}

export function selectionText(node: React.ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(selectionText).join(" ");
    if (React.isValidElement(node)) return selectionText(node.props.children);
    return "";
}

export function useAsyncSelectionOptions<T>(getOptions: AsyncSelectionProps<T>["getOptions"], filterText: string, enabled: boolean): SelectionQuery<T> {
    const [revision, refresh] = React.useReducer(n => n + 1, 0);
    const [state, setState] = React.useState<{ items: T[]; filter: string; loading: boolean; error: boolean }>({ items: [], filter: filterText, loading: enabled, error: false });
    React.useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        setState(previous => ({ ...previous, loading: true, error: false }));
        // Call each provider once, and ignore results from an older search or an unmounted picker.
        Promise.resolve().then(() => getOptions({ quickFilter: filterText || undefined })).then(
            items => { if (!cancelled) setState({ items, filter: filterText, loading: false, error: false }); },
            () => { if (!cancelled) setState(previous => ({ ...previous, filter: filterText, loading: false, error: true })); },
        );
        return () => { cancelled = true; };
    }, [getOptions, filterText, enabled, revision]);
    return {
        items: state.items, isLoading: enabled && state.loading && state.items.length === 0,
        isFetching: enabled && state.loading, isError: enabled && state.error,
        isPreviousData: enabled && state.filter !== filterText, refetch: refresh,
    };
}

export function makeAsyncSelectionSource<T>(props: AsyncSelectionProps<T>): SelectionSource<T> {
    const getLabel = (item: T) => props.getOptionInfo(item).name || selectionText(props.renderOption(item)) || String(props.getOptionInfo(item).id);
    return {
        getKey: item => props.getOptionInfo(item).id,
        getLabel,
        renderValue: item => {
            const info = props.getOptionInfo(item);
            return <CMChip size={props.chipSize || "small"} shape={props.chipShape || "rectangle"} color={info.color} tooltip={info.tooltip} variation={StandardVariationSpec.Strong}>{props.renderOption(item)}</CMChip>;
        },
        renderChoice: props.renderChoice ?? (choice => {
            const info = props.getOptionInfo(choice.item);
            return <CMChip size={props.chipSize || "small"} shape={props.chipShape || "rectangle"} color={info.color} tooltip={info.tooltip} {...getSelectionChipProps(choice)}>{props.renderOption(choice.item)}</CMChip>;
        }),
        matchesText: props.doesItemExactlyMatchText || ((item, text) => getLabel(item).trim().toLocaleLowerCase() === text.toLocaleLowerCase()),
        useOptions(filterText, enabled) {
            const query = useAsyncSelectionOptions(props.getOptions, filterText, enabled);
            return {
                ...query,
                items: filterSelectionItems(query.items, getLabel, filterText),
                createOption: props.allowInsertFromString !== false ? props.doInsertFromString : undefined,
            };
        },
    };
}

export function withNullSelection<T>(source: SelectionSource<T>, nullBehavior: CMSelectNullBehavior | undefined, renderNull?: () => React.ReactNode, nullLabel = "None", chipAppearance?: Pick<AsyncSelectionProps<T>, "chipSize" | "chipShape">): SelectionSource<T | null | undefined> {
    const nullable = nullBehavior === CMSelectNullBehavior.AllowNull || nullBehavior === CMSelectNullBehavior.AllowUndefined;
    const empty = nullBehavior === CMSelectNullBehavior.AllowNull ? null : undefined;
    return {
        getKey: item => item == null ? "null" : `item:${source.getKey(item)}`,
        getLabel: item => item == null ? selectionText(renderNull?.()) || nullLabel : source.getLabel(item),
        renderValue: item => item == null ? renderNull?.() || nullLabel : source.renderValue(item),
        renderChoice: choice => {
            if (choice.item == null) {
                return <CMChip size={chipAppearance?.chipSize || "small"} shape={chipAppearance?.chipShape || "rectangle"} {...getSelectionChipProps(choice)}>{renderNull?.() || nullLabel}</CMChip>;
            }
            return source.renderChoice({ ...choice, item: choice.item });
        },
        renderOption: (item, selected) => item == null ? renderNull?.() || nullLabel : source.renderOption?.(item, selected) || source.renderValue(item),
        matchesText: (item, text) => item != null && !!source.matchesText?.(item, text),
        useOptions(filterText, enabled) {
            const query = source.useOptions(filterText, enabled);
            return { ...query, hasMatches: query.items.length > 0, items: nullable ? [empty, ...query.items] : query.items };
        },
    };
}

export function singleSelectionValue<T>(value: T | null | undefined, nullBehavior?: CMSelectNullBehavior): (T | null | undefined)[] {
    if (value != null) return [value];
    if (nullBehavior === CMSelectNullBehavior.AllowNull) return [null];
    if (nullBehavior === CMSelectNullBehavior.AllowUndefined) return [undefined];
    return [];
}
