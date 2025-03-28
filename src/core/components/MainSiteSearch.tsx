import { Autocomplete, InputBase } from '@mui/material';
import * as React from 'react';
import { gIconMap } from "../db3/components/IconMap";
import { CMSmallButton, simulateLinkClick } from './CMCoreComponents2';
import { fetchObjectQuery } from './setlistPlan/ItemAssociation';
import { IsNullOrWhitespace } from 'shared/utils';
import { QuickSearchItemMatch, QuickSearchItemType } from 'shared/quickFilter';

export const MatchingSlugItemComponent = ({ item, selected }: { item: QuickSearchItemMatch, selected: boolean }) => {

    return <div className={`autoCompleteCMLinkItem ${item.itemType} ${selected ? "selected" : "notSelected"}`}>
        {item.itemType === "event" && gIconMap.CalendarMonth()}
        {item.itemType === "song" && gIconMap.MusicNote()}
        {item.itemType === "user" && gIconMap.Person()}
        {/* {item.itemType === "instrument" && gIconMap.MusicNote()} */}
        {item.itemType === "wikiPage" && gIconMap.EditNote()}
        {item.name}
    </div>;

};

export const MainSiteSearch = () => {
    const [query, setQuery] = React.useState<string>("");
    const [results, setResults] = React.useState<QuickSearchItemMatch[]>([]);

    React.useEffect(() => {
        if (query.length < 1) {
            setResults([]);
            return;
        }
        void fetchObjectQuery(query, [QuickSearchItemType.event, QuickSearchItemType.song, QuickSearchItemType.wikiPage]).then((response) => {
            const filtered = response.filter(item => item.absoluteUri);
            setResults(filtered);
        });
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            setQuery("");
            // Prevent the Autocomplete from swallowing the event before clearing
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return <div className="MainSiteSearch">
        <Autocomplete
            value={null}
            freeSolo
            inputValue={query}
            filterOptions={(x) => x}
            onChange={(_event, newValue) => {
                if (typeof newValue === "string") return;
                if (newValue && newValue.absoluteUri) {
                    simulateLinkClick(newValue.absoluteUri);
                }
            }}
            options={results}
            getOptionLabel={(option) => (option as QuickSearchItemMatch).name}
            getOptionKey={(option) => `${(option as QuickSearchItemMatch).itemType}_${(option as QuickSearchItemMatch).id}`}
            renderOption={(props, option, { selected }) => (
                <li {...props}><MatchingSlugItemComponent item={option} selected={selected} /></li>
            )}
            renderInput={(params) => (
                <InputBase
                    ref={params.InputProps.ref}
                    placeholder="Search..."
                    inputProps={{
                        ...params.inputProps,
                        onKeyDown: handleKeyDown,
                    }}
                    onChange={(e) => setQuery(e.target.value)}
                    startAdornment={gIconMap.Search()}
                    endAdornment={IsNullOrWhitespace(query) ? undefined : <CMSmallButton onClick={() => setQuery("")}>{gIconMap.Close()}</CMSmallButton>}
                />
            )}
        />
    </div>;
}