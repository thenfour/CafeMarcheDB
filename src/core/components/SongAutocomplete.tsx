// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { useQuery } from '@blitzjs/rpc';
import { InputBase } from "@mui/material";
import Autocomplete, { AutocompleteRenderInputParams } from '@mui/material/Autocomplete';
import React from "react";
import * as db3 from "src/core/db3/db3";
import getFilteredSongs from '../db3/queries/getFilteredSongs';
import { GetFilteredSongsItemSongPayload } from '../db3/shared/apiTypes';


export interface SongAutocompleteProps {
    value: db3.SongPayload | null;
    //index: number;
    onChange: (value: GetFilteredSongsItemSongPayload | null) => void;
    fadedSongIds?: number[];
};

export const SongAutocomplete = ({ value, onChange, fadedSongIds }: SongAutocompleteProps) => {
    const [inputValue, setInputValue] = React.useState(''); // value of the input
    const [debouncedValue, setDebouncedValue] = React.useState(''); // debounced input value
    const [hasChanged, setHasChanged] = React.useState(false);

    if (!fadedSongIds) fadedSongIds = [];

    // Debouncing user input to avoid excessive fetches
    React.useEffect(() => {
        const timerId = setTimeout(() => {
            setDebouncedValue(inputValue);
            setHasChanged(true);
        }, 100);
        return () => clearTimeout(timerId);
    }, [inputValue]);

    // Fetching songs based on debounced input value
    const [songs__] = useQuery(getFilteredSongs, { autocompleteQuery: debouncedValue }, {
        suspense: false,
        enabled: hasChanged && Boolean(debouncedValue)
    });
    const songs = (songs__?.matchingItems) || [];

    const filterOptions = (options: db3.SongPayload[], { inputValue }: { inputValue: string }) => {
        return options;
    };

    const handleChange = (newValue: GetFilteredSongsItemSongPayload | null | string) => {
        if (typeof newValue === "string") {
            // never called anyway but in case it was we should ignore.
            return;
        }
        setHasChanged(true);
        setInputValue(""); // assuming the caller will use this value and then wants the autocomplete to be reset
        onChange(newValue);
    };

    return <Autocomplete
        options={songs || []}
        value={value}
        onChange={(event, newValue) => handleChange(newValue)}
        className='songAutocomplete'

        fullWidth={true}
        openOnFocus={false}
        inputValue={inputValue}
        onInputChange={(event, newInputValue) => setInputValue(newInputValue)}

        // used to populate the input box
        getOptionLabel={(option: GetFilteredSongsItemSongPayload | string) => {
            if (typeof (option) === 'string') {
                return option;
            }
            return option.name;
        }}
        getOptionKey={(option) => {
            if (typeof (option) === 'string') {
                return `free:${option}`;
            }
            return `id:${option.id}`;
        }}
        filterOptions={filterOptions}
        freeSolo={true} // required because options are fetched async and therefore may not match the selected item.

        isOptionEqualToValue={(option, value) => {
            if (typeof value === 'string') {
                if (typeof option === 'string') {
                    return option === value;
                }
                return option.name === value;
            }
            if (typeof option === 'string') {
                return option === value.name;
            }
            return option.name === value.name;
        }}
        renderOption={(props, option) => {
            const songId = typeof option === 'string' ? null : option.id as number;
            return <li {...props} className={`${props.className} songAutocompleteLI ${(songId && fadedSongIds!.includes(songId)) ? "faded" : "notfaded"}`}>
                {typeof option === 'string' ? option : option.name}
            </li>
        }}
        renderInput={(params: AutocompleteRenderInputParams) => {
            const { InputLabelProps, InputProps, ...rest } = params;
            const inputProps = { ...params.InputProps, ...rest };

            return <div className="cmdbSimpleInputWrapper">
                <InputBase
                    {...inputProps}
                    onMouseDownCapture={(e) => e.stopPropagation()}
                />
            </div>;
        }}
    />;
};



