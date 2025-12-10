import { Autocomplete, InputBase } from "@mui/material";
import React from "react";
import { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import { IsNullOrWhitespace } from "shared/utils";
import { gIconMap } from "src/core/db3/components/IconMap";
import { CMSmallButton, NameValuePair } from "./CMCoreComponents2";
import { CMTextInputBase } from "./CMTextField";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { useFeatureRecorder } from "./dashboardContext/DashboardContext";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for allowed item types best to use QuickSearchItemTypeSets
export async function fetchObjectQuery(keyword: string, allowedItemTypes: QuickSearchItemType[]): Promise<QuickSearchItemMatch[]> {
    const params = new URLSearchParams({
        keyword,
        allowedItemTypes: JSON.stringify(allowedItemTypes),
    });
    //const response = await fetch(`/api/wiki/quickSearch?keyword=${keyword}&allowedItemTypes=${JSON.stringify(allowedItemTypes)}`);
    const response = await fetch(`/api/wiki/quickSearch?${params.toString()}`);

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const ret = await response.json() as QuickSearchItemMatch[];
    return ret;
}

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
export interface AssociationSelectProps {
    title?: string;
    value: QuickSearchItemMatch | null;
    onChange: (newValue: QuickSearchItemMatch | null) => void;
    allowedItemTypes: QuickSearchItemType[]; // see QuickSearchItemTypeSets
    allowNull?: boolean;
};

// could use an AutoComplete, but this is just easier.
export const AssociationSelect = ({ allowNull = true, ...props }: AssociationSelectProps) => {
    const [query, setQuery] = React.useState<string>("");
    const [results, setResults] = React.useState<QuickSearchItemMatch[]>([]);

    React.useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }
        void fetchObjectQuery(query, props.allowedItemTypes).then((response) => {
            setResults(response);
        });
    }, [query]);

    return <NameValuePair
        name={props.title || "Association"}
        value={
            <div className="AssociationSelect">
                <CMTextInputBase
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <div style={{ display: "flex" }}>
                    {allowNull && !!props.value && <div className="selectable deemphasizedWithHover" onClick={() => props.onChange(null)}>{gIconMap.Close()}</div>}
                    <AssociationValueLink value={props.value} />
                </div>
                <div className="autoCompleteResults">
                    {results.map((item, index) => <div
                        key={index}
                        className="selectable"
                        onClick={() => {
                            props.onChange(item);
                            setQuery("");
                        }}
                    >
                        <AssociationValue
                            key={index}
                            value={item}
                            className="selectable" />
                    </div>
                    )}
                </div>
            </div>
        }
    />;
};

interface AssociationAutocompleteItemInfo {
    style?: React.CSSProperties;
    className?: string;
};

export interface AssociationAutocompleteProps {
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
    onSelect: (newValue: QuickSearchItemMatch | null, queryText: string) => void;

    /**
     * Allowed item types for the fetch operation.
     */
    allowedItemTypes: QuickSearchItemType[];

    showSearchIcon?: boolean;
    showClearIcon?: boolean;
    placeholder?: string;
    disableEscapeHandling?: boolean; // if true, pressing escape will not clear the input. this is useful for dialogs that use this component and want to close the dialog instead.

    getItemInfo?: (item: QuickSearchItemMatch) => AssociationAutocompleteItemInfo;
}

export const AssociationAutocomplete = ({
    autofocus = false,
    showSearchIcon = true,
    showClearIcon = true,
    placeholder = "Search...",
    disableEscapeHandling = false,
    ...props
}: AssociationAutocompleteProps) => {
    const isControlled = props.value !== undefined;
    const recordFeature = useFeatureRecorder();

    // Internal, "uncontrolled" state
    const [internalValue, setInternalValue] = React.useState(
        props.defaultValue ?? ""
    );

    // The actual text we display in the input
    const queryText = isControlled ? props.value! : internalValue;

    // Autocomplete search results
    const [results, setResults] = React.useState<QuickSearchItemMatch[]>([]);

    // When queryText changes, fetch new results
    React.useEffect(() => {
        if (IsNullOrWhitespace(queryText)) {
            setResults([]);
            return;
        }

        void fetchObjectQuery(queryText, props.allowedItemTypes).then((response) => {
            const filtered = response.filter((item) => item.absoluteUri);
            setResults(filtered);
        });
    }, [queryText, props.allowedItemTypes]);

    const handleTextChange = (newValue: string) => {
        // Update internal state only if we're uncontrolled
        if (!isControlled) {
            setInternalValue(newValue);
        }
        // Let the parent know about any change
        props.onValueChange?.(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (disableEscapeHandling) return; // don't handle escape if we are not supposed to
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

                await recordFeature({
                    feature: ActivityFeature.link_follow_internal,
                    queryText: queryText,
                    eventId: newValue?.itemType === QuickSearchItemType.event ? newValue.id : undefined,
                    songId: newValue?.itemType === QuickSearchItemType.song ? newValue.id : undefined,
                    wikiPageId: newValue?.itemType === QuickSearchItemType.wikiPage ? newValue.id : undefined,
                });
                props.onSelect(newValue, queryText);
            }}
            options={results}
            getOptionLabel={(option) => {
                if (typeof option === "string") {
                    return option;
                }
                return (option as QuickSearchItemMatch).name
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