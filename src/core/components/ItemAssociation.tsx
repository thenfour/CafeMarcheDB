import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";
import { QuickSearchRecoveryNotice } from "./search/QuickSearchRecoveryNotice";
import { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import { gIconMap } from "src/core/db3/components/IconMap";
import { NameValuePair } from "./CMCoreComponents2";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for allowed item types best to use QuickSearchItemTypeSets
export async function fetchObjectQuery<TItemType extends QuickSearchItemType>(
    _keyword: string,
    _allowedItemTypes: readonly TItemType[],
): Promise<QuickSearchItemMatch<TItemType>[]> {
    return requireRestoredApplicationFeature("quickSearch");
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
export interface AssociationSelectProps<TItemType extends QuickSearchItemType = QuickSearchItemType> {
    title?: string;
    value: QuickSearchItemMatch<TItemType> | null;
    onChange: (newValue: QuickSearchItemMatch<TItemType> | null) => void;
    allowedItemTypes: readonly TItemType[]; // see QuickSearchItemTypeSets
    allowNull?: boolean;
};

// could use an AutoComplete, but this is just easier.
export function AssociationSelect<TItemType extends QuickSearchItemType>(props: AssociationSelectProps<TItemType>) {
    const locale = useLocale();
    return <NameValuePair name={props.title || locale.getPlainString("recovery.quickSearch.association")} value={
        <div className="AssociationSelect">
            <QuickSearchRecoveryNotice />
            <AssociationValueLink value={props.value} />
        </div>
    } />;
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

    showSearchIcon?: boolean;
    showClearIcon?: boolean;
    placeholder?: string;
    disableEscapeHandling?: boolean; // if true, pressing escape will not clear the input. this is useful for dialogs that use this component and want to close the dialog instead.

    getItemInfo?: (item: QuickSearchItemMatch<TItemType>) => AssociationAutocompleteItemInfo;
}

// Keep all callers inert, including Markdown dialogs and the unmounted shell search.
export function AssociationAutocomplete<TItemType extends QuickSearchItemType>(_props: AssociationAutocompleteProps<TItemType>) {
    return <QuickSearchRecoveryNotice />;
}

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/ItemAssociation.tsx:1-2
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: b012ec5f8cd8495798016c523e966aeec26404dc69ff36a7290ca80f57398de4
// MIGRATION_REFERENCE_BEGIN
// import { Autocomplete, InputBase } from "@mui/material";
// import React from "react";
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/ItemAssociation.tsx:4-4
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 408cb8eebba74743a643cdaeaa3f0592a5c64bb4f3b386a9555c8ad31cec3c10
// MIGRATION_REFERENCE_BEGIN
// import { IsNullOrWhitespace } from "shared/utils";
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/ItemAssociation.tsx:6-9
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: e60cd2f4bc6eeec2a4357cd233eb424146176c43297092df6539ee9fa08f68f3
// MIGRATION_REFERENCE_BEGIN
// import { CMSmallButton, NameValuePair } from "./CMCoreComponents2";
// import { CMTextInputBase } from "./CMTextField";
// import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
// import { useFeatureRecorder } from "./dashboardContext/DashboardContext";
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/ItemAssociation.tsx:14-33
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: c3054afe40262c960227d4652e78f2d1ddcd07bc01df1209e814a480d0f18af9
// MIGRATION_REFERENCE_BEGIN
// export async function fetchObjectQuery<TItemType extends QuickSearchItemType>(
//     keyword: string,
//     allowedItemTypes: readonly TItemType[],
// ): Promise<QuickSearchItemMatch<TItemType>[]> {
//     const params = new URLSearchParams({
//         keyword,
//         allowedItemTypes: JSON.stringify(allowedItemTypes),
//     });
//     //const response = await fetch(`/api/wiki/quickSearch?keyword=${keyword}&allowedItemTypes=${JSON.stringify(allowedItemTypes)}`);
//     const response = await fetch(`/api/wiki/quickSearch?${params.toString()}`);
//
//     if (!response.ok) {
//         throw new Error('Network response was not ok');
//     }
//     // The endpoint returns the discriminated result union requested by the
//     // allowed type list; response.json() itself has no generic result type.
//     const ret = await response.json() as QuickSearchItemMatch<TItemType>[];
//     return ret;
// }
//
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/ItemAssociation.tsx:94-143
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: dec50fc5857cd5540a622261a16a71292946c6be7a92b4a3fb9245bfd7f17ba8
// MIGRATION_REFERENCE_BEGIN
// export const AssociationSelect = <TItemType extends QuickSearchItemType,>({
//     allowNull = true,
//     ...props
// }: AssociationSelectProps<TItemType>) => {
//     const [query, setQuery] = React.useState<string>("");
//     const [results, setResults] = React.useState<QuickSearchItemMatch<TItemType>[]>([]);
//
//     React.useEffect(() => {
//         if (query.length < 2) {
//             setResults([]);
//             return;
//         }
//         void fetchObjectQuery(query, props.allowedItemTypes).then((response) => {
//             setResults(response);
//         });
//     }, [query]);
//
//     return <NameValuePair
//         name={props.title || "Association"}
//         value={
//             <div className="AssociationSelect">
//                 <CMTextInputBase
//                     value={query}
//                     onChange={(e) => setQuery(e.target.value)}
//                 />
//                 <div style={{ display: "flex" }}>
//                     {allowNull && !!props.value && <div className="selectable deemphasizedWithHover" onClick={() => props.onChange(null)}>{gIconMap.Close()}</div>}
//                     <AssociationValueLink value={props.value} />
//                 </div>
//                 <div className="autoCompleteResults">
//                     {results.map((item, index) => <div
//                         key={index}
//                         className="selectable"
//                         onClick={() => {
//                             props.onChange(item);
//                             setQuery("");
//                         }}
//                     >
//                         <AssociationValue
//                             key={index}
//                             value={item}
//                             className="selectable" />
//                     </div>
//                     )}
//                 </div>
//             </div>
//         }
//     />;
// };
//
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/ItemAssociation.tsx:188-320
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: d013eb45ced29f37ae13ac189ec0a6cc15dab433f565e2523dbde3a07bc16f32
// MIGRATION_REFERENCE_BEGIN
// const getActivityIdentities = (value: QuickSearchItemMatch | null) => ({
//     eventId: value?.itemType === QuickSearchItemType.event
//         ? value.id
//         : undefined,
//     songId: value?.itemType === QuickSearchItemType.song
//         ? value.id
//         : undefined,
//     wikiPageId: value?.itemType === QuickSearchItemType.wikiPage
//         ? value.id
//         : undefined,
// });
//
// export const AssociationAutocomplete = <TItemType extends QuickSearchItemType,>({
//     autofocus = false,
//     showSearchIcon = true,
//     showClearIcon = true,
//     placeholder = "Search...",
//     disableEscapeHandling = false,
//     ...props
// }: AssociationAutocompleteProps<TItemType>) => {
//     const isControlled = props.value !== undefined;
//     const recordFeature = useFeatureRecorder();
//
//     // Internal, "uncontrolled" state
//     const [internalValue, setInternalValue] = React.useState(
//         props.defaultValue ?? ""
//     );
//
//     // The actual text we display in the input
//     const queryText = isControlled ? props.value! : internalValue;
//
//     // Autocomplete search results
//     const [results, setResults] = React.useState<QuickSearchItemMatch<TItemType>[]>([]);
//
//     // When queryText changes, fetch new results
//     React.useEffect(() => {
//         if (IsNullOrWhitespace(queryText)) {
//             setResults([]);
//             return;
//         }
//
//         void fetchObjectQuery(queryText, props.allowedItemTypes).then((response) => {
//             const filtered = response.filter((item) => item.absoluteUri);
//             setResults(filtered);
//         });
//     }, [queryText, props.allowedItemTypes]);
//
//     const handleTextChange = (newValue: string) => {
//         // Update internal state only if we're uncontrolled
//         if (!isControlled) {
//             setInternalValue(newValue);
//         }
//         // Let the parent know about any change
//         props.onValueChange?.(newValue);
//     };
//
//     const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
//         if (disableEscapeHandling) return; // don't handle escape if we are not supposed to
//         if (e.key === "Escape" && !IsNullOrWhitespace(queryText)) { // don't handle if input empty, to allow dialogs to close
//             // Clear out the text
//             handleTextChange("");
//             // Prevent the Autocomplete from swallowing the event before clearing
//             e.preventDefault();
//             e.stopPropagation();
//         }
//     };
//
//     return (
//         <Autocomplete
//             className="AssociationAutocomplete"
//             value={null}
//             freeSolo
//             // Tells Autocomplete how to track the current text for search
//             inputValue={queryText}
//             filterOptions={(x) => x}
//             onChange={async (_event, newValue) => {
//                 // newValue can be a string if freeSolo is true, or an object
//                 if (typeof newValue === "string") {
//                     // Typically we ignore string input since we are using freeSolo
//                     // but you might do something with that here if you want
//                     return;
//                 }
//
//                 await recordFeature({
//                     feature: ActivityFeature.link_follow_internal,
//                     queryText: queryText,
//                     ...getActivityIdentities(newValue),
//                 });
//                 props.onSelect(newValue, queryText);
//             }}
//             options={results}
//             getOptionLabel={(option) => {
//                 if (typeof option === "string") {
//                     return option;
//                 }
//                 return option.name
//             }
//             }
//             // getOptionKey is not a standard Autocomplete prop. You can just set a key in renderOption.
//             renderOption={(liProps, option, { selected }) => {
//                 const extraInfo: AssociationAutocompleteItemInfo = !props.getItemInfo ? {} : props.getItemInfo(option);
//                 return <li {...liProps} key={`${option.itemType}_${option.id}`}>
//                     <AssociationValue
//                         value={option}
//                         className={`autoCompleteCMLinkItem ${extraInfo.className || ""}`}
//                         style={extraInfo.style}
//                         selected={selected}
//                     />
//                 </li>;
//             }}
//             renderInput={(params) => (
//                 <InputBase
//                     ref={params.InputProps.ref}
//                     placeholder={placeholder}
//                     autoFocus={autofocus}
//                     inputProps={{
//                         ...params.inputProps,
//                         onKeyDown: handleKeyDown,
//                     }}
//                     onChange={(e) => handleTextChange(e.target.value)}
//                     startAdornment={showSearchIcon ? gIconMap.Search() : undefined}
//                     endAdornment={
//                         (IsNullOrWhitespace(queryText) || !showClearIcon) ? undefined : (
//                             <CMSmallButton onClick={() => handleTextChange("")}>
//                                 {gIconMap.Close()}
//                             </CMSmallButton>
//                         )
//                     }
//                 />
//             )}
//         />
//     );
// };
// MIGRATION_REFERENCE_END
