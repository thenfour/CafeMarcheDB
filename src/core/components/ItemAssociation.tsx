import React from "react";
import { Autocomplete, InputBase } from "@mui/material";
import { IsNullOrWhitespace } from "shared/utils";
import type { QuickSearchPermissionPolicy } from "src/core/db3/shared/quickSearchTypes";
import { useLocale } from "src/locale/components/useLocale";
import { QuickSearchRecoveryNotice } from "./search/QuickSearchRecoveryNotice";
import { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import { gIconMap } from "src/core/db3/components/IconMap";
import { CMSmallButton, NameValuePair } from "./CMCoreComponents2";
import { ActivityFeature } from "./featureReports/activityTracking";
import { useDashboardContext, useFeatureRecorder } from "./dashboardContext/DashboardContext";
import { CMTextInputBase } from "./CMTextField";
import { useQuickSearchResults, useQuickSearchScopeKey } from "./search/useQuickSearchResults";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for allowed item types best to use QuickSearchItemTypeSets
export { fetchObjectQuery } from "./search/quickSearchClient";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const AssociationValueLink = (props: { value: QuickSearchItemMatch | null, className?: string | undefined, selected?: boolean }) => {

    const className = `AssociationValue autoCompleteCMLinkItem ${props.className || ""} ${props.value?.itemType || "null"} ${props.selected ? "selected" : "notSelected"}`;

    if (!props.value) return <div className={className}>-</div>;
    switch (props.value?.itemType) {
        case "song":
            return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={props.value.absoluteUri}>{gIconMap.MusicNote()} {props.value?.name}</a></div>;
        case "event":
            return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={props.value.absoluteUri}>{gIconMap.CalendarMonth()} {props.value?.name}</a></div>;
        case "user":
            return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={props.value.absoluteUri}>{gIconMap.Person()} {props.value?.name}</a></div>;
        // case "instrument":
        //     return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={props.value.absoluteUri}>{gIconMap.Trumpet()} {props.value?.name}</a></div>;
        case "wikiPage":
            return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={props.value.absoluteUri}>{gIconMap.EditNote()} {props.value?.name}</a></div>;
        default:
            return <div className={className}>{props.value?.name}</div>;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface AssociationValueProps {
    value: QuickSearchItemMatch | null;
    className?: string | undefined;
    selected?: boolean;
    style?: React.CSSProperties | undefined;
};
export const AssociationValue = (props: AssociationValueProps) => {

    const className = `AssociationValue autoCompleteCMLinkItem ${props.className || ""} ${props.value?.itemType || "null"} ${props.selected ? "selected" : "notSelected"}`;

    if (!props.value) return <div className={className}>-</div>;
    switch (props.value?.itemType) {
        case "song":
            return <div className={className} style={props.style}>{gIconMap.MusicNote()} {props.value?.name}</div>;
        case "event":
            return <div className={className} style={props.style}>{gIconMap.CalendarMonth()} {props.value?.name}</div>;
        case "user":
            return <div className={className} style={props.style}>{gIconMap.Person()} {props.value?.name}</div>;
        // case "instrument":
        //     return <div className={className}>{gIconMap.Trumpet()} {props.value?.name}</div>;
        case "wikiPage":
            return <div className={className} style={props.style}>{gIconMap.EditNote()} {props.value?.name}</div>;
        default:
            return <div className={className} style={props.style}>{props.value?.name}</div>;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface AssociationSelectProps<TItemType extends QuickSearchItemType = QuickSearchItemType> {
    title?: string;
    value: QuickSearchItemMatch<TItemType> | null;
    onChange: (newValue: QuickSearchItemMatch<TItemType> | null) => void;
    allowedItemTypes: readonly TItemType[]; // see QuickSearchItemTypeSets
    allowNull: boolean;
    permissionPolicy: QuickSearchPermissionPolicy;
    searchEnabled: boolean;
};

// could use an AutoComplete, but this is just easier.
export function AssociationSelect<TItemType extends QuickSearchItemType>(props: AssociationSelectProps<TItemType>) {
    const locale = useLocale();
    return <NameValuePair name={props.title || locale.getPlainString("recovery.quickSearch.association")} value={
        props.searchEnabled ? <BandAssociationSelect {...props} /> : <div className="AssociationSelect">
            <QuickSearchRecoveryNotice />
            <AssociationValueLink value={props.value} />
        </div>
    } />;
}

function BandAssociationSelect<TItemType extends QuickSearchItemType>(props: AssociationSelectProps<TItemType>) {
    const scopeKey = useQuickSearchScopeKey();
    return <ScopedAssociationSelect key={scopeKey} {...props} />;
}

function ScopedAssociationSelect<TItemType extends QuickSearchItemType>(props: AssociationSelectProps<TItemType>) {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    const [query, setQuery] = React.useState("");
    const [highlighted, setHighlighted] = React.useState<string | null>(null);
    const { results, status, isCurrent } = useQuickSearchResults({ query, allowedItemTypes: props.allowedItemTypes,
        permissionPolicy: props.permissionPolicy, minimumCharacters: 2, enabled: props.searchEnabled });
    const resultKey = (item: QuickSearchItemMatch<TItemType>) => `${item.itemType}/${item.id}`;
    const activeIndex = results.findIndex(item => resultKey(item) === highlighted);
    const changeQuery = (value: string) => {
        setQuery(value);
        setHighlighted(null);
    };
    const select = (item: QuickSearchItemMatch<TItemType>) => {
        if (!isCurrent() || !results.includes(item)) {
            return;
        }
        props.onChange(item);
        changeQuery("");
    };
    const handleInputKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!(event.target instanceof HTMLInputElement)) {
            return;
        }
        if (event.key === "Escape") {
            changeQuery("");
            event.preventDefault();
        } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length > 0) {
            const index = event.key === "ArrowDown" ? Math.min(activeIndex + 1, results.length - 1) : Math.max(activeIndex - 1, 0);
            setHighlighted(resultKey(results[index]!));
            event.preventDefault();
        } else if (event.key === "Enter" && activeIndex >= 0) {
            select(results[activeIndex]!);
            event.preventDefault();
        }
    };
    const clear = () => props.onChange(null);
    return <div className="AssociationSelect" onKeyDown={handleInputKey}>
        <CMTextInputBase value={query} onChange={(_event, value) => changeQuery(value)}
            readOnly={!dashboard.authorizationContext?.bandPublicId} aria-label={props.title || locale.getPlainString("recovery.quickSearch.association")} />
        <div style={{ display: "flex" }}>
            {props.allowNull && props.value && <div role="button" tabIndex={0} aria-label={locale.getPlainString("search.quick.clearAssociation")}
                className="selectable deemphasizedWithHover" onClick={clear} onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                        clear();
                        event.preventDefault();
                    }
                }}>{gIconMap.Close()}</div>}
            <AssociationValueLink value={props.value} />
        </div>
        {status === "error" && <div role="alert">{locale.getPlainString("search.quick.failed")}</div>}
        <div className="autoCompleteResults" role="listbox" aria-label={locale.getPlainString("search.quick.suggestions")}>
            {results.map((item, index) => <div key={resultKey(item)} role="option" tabIndex={0}
                aria-selected={index === activeIndex} className="selectable" onClick={() => select(item)} onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                        select(item);
                        event.preventDefault();
                    }
                }}>
                <AssociationValue value={item} className="selectable" selected={index === activeIndex} />
            </div>)}
        </div>
    </div>;
}

interface AssociationAutocompleteItemInfo {
    style?: React.CSSProperties;
    className?: string;
};

export interface AssociationAutocompleteProps<TItemType extends QuickSearchItemType = QuickSearchItemType> {
    autofocus?: boolean;
    /**
     * The current query text value (controlled).
     * If provided, this component will ignore its own internal state and
     * display `value` exactly as passed. Changes are signaled via onValueChange.
     */
    value?: string;
    /**
     * The initial query text value (uncontrolled).
     * Only used if `value` is not provided.
     */
    defaultValue?: string;

    /**
     * Called when the input text changes.
     * For a controlled component, you must update `value` in your parent to keep it in sync.
     * For an uncontrolled component, the new value is also stored internally.
     */
    onValueChange?: (newQuery: string) => void;

    /**
     * Called when the user selects a result from the Autocomplete list.
     */
    onSelect: (newValue: QuickSearchItemMatch<TItemType> | null, queryText: string) => void;

    /**
     * Allowed item types for the fetch operation.
     */
    allowedItemTypes: readonly TItemType[];
    permissionPolicy: QuickSearchPermissionPolicy;

    /** The caller owns readiness of its complete selection workflow. */
    searchEnabled: boolean;

    showSearchIcon?: boolean;
    showClearIcon?: boolean;
    placeholder?: string;
    disableEscapeHandling?: boolean; // if true, pressing escape will not clear the input. this is useful for dialogs that use this component and want to close the dialog instead.

    getItemInfo?: (item: QuickSearchItemMatch<TItemType>) => AssociationAutocompleteItemInfo;
}

const getActivityIdentities = (value: QuickSearchItemMatch | null) => ({
    eventId: value?.itemType === QuickSearchItemType.event
        ? value.id
        : undefined,
    songId: value?.itemType === QuickSearchItemType.song
        ? value.id
        : undefined,
    wikiPageId: value?.itemType === QuickSearchItemType.wikiPage
        ? value.id
        : undefined,
});

const ScopedAssociationAutocomplete = <TItemType extends QuickSearchItemType,>({
    autofocus = false,
    showSearchIcon = true,
    showClearIcon = true,
    placeholder = "Search...", // todo: localize
    disableEscapeHandling = false,
    ...props
}: AssociationAutocompleteProps<TItemType>) => {
    const isControlled = props.value !== undefined;
    const recordFeature = useFeatureRecorder();

    // Internal, "uncontrolled" state
    const [internalValue, setInternalValue] = React.useState(
        props.defaultValue ?? ""
    );

    // The actual text we display in the input
    const queryText = isControlled ? props.value! : internalValue;

    const { results: matches, isCurrent } = useQuickSearchResults({ query: queryText, allowedItemTypes: props.allowedItemTypes,
        permissionPolicy: props.permissionPolicy, minimumCharacters: 1, enabled: props.searchEnabled });
    const results = matches.filter(item => item.absoluteUri);

    const handleTextChange = (newValue: string) => {
        // Update internal state only if we're uncontrolled
        if (!isControlled) {
            setInternalValue(newValue);
        }
        // Let the parent know about any change
        props.onValueChange?.(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (disableEscapeHandling) {
            return;
        }
        if (e.key === "Escape" && !IsNullOrWhitespace(queryText)) { // don't handle if input empty, to allow dialogs to close
            // Clear out the text
            handleTextChange("");
            // Prevent the Autocomplete from swallowing the event before clearing
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <Autocomplete
            className="AssociationAutocomplete"
            value={null}
            freeSolo
            // Tells Autocomplete how to track the current text for search
            inputValue={queryText}
            filterOptions={(x) => x}
            onChange={async (_event, newValue) => {
                // newValue can be a string if freeSolo is true, or an object
                if (typeof newValue === "string") {
                    // Typically we ignore string input since we are using freeSolo
                    // but you might do something with that here if you want
                    return;
                }

                if (newValue && !results.includes(newValue)) {
                    return;
                }

                await recordFeature({
                    feature: ActivityFeature.link_follow_internal,
                    queryText: queryText,
                    ...getActivityIdentities(newValue),
                });
                if (!isCurrent()) {
                    return;
                }
                props.onSelect(newValue, queryText);
            }}
            options={results}
            getOptionLabel={(option) => {
                if (typeof option === "string") {
                    return option;
                }
                return option.name
            }
            }
            // getOptionKey is not a standard Autocomplete prop. You can just set a key in renderOption.
            renderOption={(liProps, option, { selected }) => {
                const extraInfo: AssociationAutocompleteItemInfo = !props.getItemInfo ? {} : props.getItemInfo(option);
                return <li {...liProps} key={`${option.itemType}_${option.id}`}>
                    <AssociationValue
                        value={option}
                        className={`autoCompleteCMLinkItem ${extraInfo.className || ""}`}
                        style={extraInfo.style}
                        selected={selected}
                    />
                </li>;
            }}
            renderInput={(params) => (
                <InputBase
                    ref={params.InputProps.ref}
                    placeholder={placeholder}
                    autoFocus={autofocus}
                    inputProps={{
                        ...params.inputProps,
                        onKeyDown: handleKeyDown,
                    }}
                    onChange={(e) => handleTextChange(e.target.value)}
                    startAdornment={showSearchIcon ? gIconMap.Search() : undefined}
                    endAdornment={
                        (IsNullOrWhitespace(queryText) || !showClearIcon) ? undefined : (
                            <CMSmallButton onClick={() => handleTextChange("")}>
                                {gIconMap.Close()}
                            </CMSmallButton>
                        )
                    }
                />
            )}
        />
    );
};

export function AssociationAutocomplete<TItemType extends QuickSearchItemType>(props: AssociationAutocompleteProps<TItemType>) {
    if (!props.searchEnabled) {
        return <QuickSearchRecoveryNotice />;
    }
    return <BandAssociationAutocomplete {...props} />;
}

function BandAssociationAutocomplete<TItemType extends QuickSearchItemType>(props: AssociationAutocompleteProps<TItemType>) {
    const scopeKey = useQuickSearchScopeKey();
    return <ScopedAssociationAutocomplete key={scopeKey} {...props} />;
}
