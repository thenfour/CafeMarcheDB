// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { useQuery } from '@blitzjs/rpc';
import React from "react";
import { QuickSearchItemMatch, QuickSearchItemType } from 'shared/quickFilter';
import * as db3 from "src/core/db3/db3";
import getFilteredSongs from '../db3/queries/getFilteredSongs';
import { GetFilteredSongsItemSongPayload } from '../db3/shared/apiTypes';
import { AssociationAutocomplete } from './setlistPlan/ItemAssociation';


export interface SongAutocompleteProps {
    value: db3.SongPayload | null;
    onChange: (value: GetFilteredSongsItemSongPayload | null) => void;
    fadedSongIds?: number[];
    autofocus?: boolean;
};

export const SongAutocomplete = ({ value, onChange, fadedSongIds = [], autofocus = false, }: SongAutocompleteProps) => {
    const [inputValue, setInputValue] = React.useState(value?.name ?? ""); // value of the input
    const [searchValue, setSearchValue] = React.useState<QuickSearchItemMatch | null>(null);

    const [fullResult, _] = useQuery(getFilteredSongs, { id: searchValue?.id || -1 }, {
        suspense: false,
    });

    React.useEffect(() => {
        if (!fullResult) {
            return;
        }
        setInputValue(""); // assuming the caller will use this value and then wants the autocomplete to be reset
        onChange(fullResult.matchingItem);
    }, [fullResult]);

    return <AssociationAutocomplete
        allowedItemTypes={[QuickSearchItemType.song]}
        value={inputValue}
        onSelect={setSearchValue}
        autofocus={autofocus}
        onValueChange={setInputValue}
        getItemInfo={(item) => {
            return {
                className: fadedSongIds.includes(item.id) ? "faded" : "notfaded",
            };
        }}
    />
};
