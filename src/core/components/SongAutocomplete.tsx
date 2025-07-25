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
import { AssociationAutocomplete } from './ItemAssociation';


export interface SongAutocompleteProps {
    value: db3.SongPayload | null;
    onChange: (value: GetFilteredSongsItemSongPayload | null) => void;
    fadedSongIds?: number[];
    autofocus?: boolean;
};

export const SongAutocomplete = ({ value, onChange, fadedSongIds = [], autofocus = false, }: SongAutocompleteProps) => {
    const [inputValue, setInputValue] = React.useState(value?.name ?? ""); // value of the input
    const [pendingSelection, setPendingSelection] = React.useState<QuickSearchItemMatch | null>(null);

    const [fullResult, _] = useQuery(getFilteredSongs, { id: pendingSelection?.id || -1 }, {
        suspense: false,
    });

    const handleSelection = React.useCallback((selection: QuickSearchItemMatch) => {
        setPendingSelection(selection);
    }, []);

    React.useEffect(() => {
        if (!pendingSelection || !fullResult) {
            return;
        }

        // Clear the pending selection first to allow the same item to be selected again
        setPendingSelection(null);
        setInputValue(""); // assuming the caller will use this value and then wants the autocomplete to be reset
        onChange(fullResult.matchingItem);
    }, [pendingSelection, fullResult, onChange]);

    return <AssociationAutocomplete
        allowedItemTypes={[QuickSearchItemType.song]}
        value={inputValue}
        onSelect={(value) => {
            if (value) {
                handleSelection(value);
            }
        }}
        autofocus={autofocus}
        onValueChange={setInputValue}
        getItemInfo={(item) => {
            return {
                className: fadedSongIds.includes(item.id) ? "faded" : "notfaded",
            };
        }}
    />
};
