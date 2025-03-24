import { Autocomplete, FormLabel, InputBase } from '@mui/material';
import * as React from 'react';
import { gIconMap } from "../db3/components/IconMap";
import { MatchingSlugItem } from '../db3/shared/apiTypes';
import { fetchObjectQuery } from './setlistPlan/ItemAssociation';
import { CMSmallButton, simulateLinkClick } from './CMCoreComponents2';

export const MatchingSlugItemComponent = ({ item, selected }: { item: MatchingSlugItem, selected: boolean }) => {

    return <div className={`autoCompleteCMLinkItem ${item.itemType} ${selected ? "selected" : "notSelected"}`}>
        {item.itemType === "event" && gIconMap.CalendarMonth()}
        {item.itemType === "song" && gIconMap.MusicNote()}
        {item.itemType === "user" && gIconMap.Person()}
        {item.itemType === "instrument" && gIconMap.MusicNote()}
        {item.itemType === "wikiPage" && gIconMap.EditNote()}
        {item.name}
    </div>;

};

export const MainSiteSearch = () => {
    const [query, setQuery] = React.useState<string>("");
    const [results, setResults] = React.useState<MatchingSlugItem[]>([]);

    React.useEffect(() => {
        if (query.length < 1) {
            setResults([]);
            return;
        }
        void fetchObjectQuery(query).then((response) => {
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
            getOptionLabel={(option) => (option as MatchingSlugItem).name}
            getOptionKey={(option) => `${(option as MatchingSlugItem).itemType}_${(option as MatchingSlugItem).id}`}
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
                    endAdornment={<CMSmallButton onClick={() => setQuery("")}>{gIconMap.Close()}</CMSmallButton>}
                />
            )}
        />
    </div>;
}