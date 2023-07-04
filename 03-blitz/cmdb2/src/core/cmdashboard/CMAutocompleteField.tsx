import { useMutation, useQuery } from "@blitzjs/rpc";
import {
    Add as AddIcon,
} from '@mui/icons-material';
import {
    Autocomplete,
    TextField
} from "@mui/material";
import { createFilterOptions } from '@mui/material/Autocomplete';
import React from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { CMAutocompleteFieldSpec } from "./CMColumnSpec";

const filterObjects = createFilterOptions();

// object fields are not just 1 value; they are an ID field and an object field.
// they must be kept in sync because they're not possible to merge into 1 field,
// and unique usages between them.
// id field is directly returned by the db, and required for updates / searches.
// obj field is required for almost everything else like rendering its info.

// but the underlying autocomplete component has a controlled singular "value" field.
// for simplicity let's use ID as the value. it's much easier to understand when the value
// changes then; rather than the object which may or may not actually represent a changed selection.

// autocomplete selection of a single related object
// https://mui.com/material-ui/react-autocomplete/#creatable
// option items are role objects themselves (not just IDs)

type CMAutocompleteFieldParams<TDBModel> = {
    valueObj: any,
    onChange: any,
    columnSpec: CMAutocompleteFieldSpec<TDBModel>,
};

export function CMAutocompleteField<TDBModel>({ valueObj, onChange, columnSpec }: CMAutocompleteFieldParams<TDBModel>) {
    const [items, { refetch }] = useQuery(columnSpec.GetAllItemsQuery, {});
    const [createMutation] = useMutation(columnSpec.CreateFromStringMutation);

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    return (<Autocomplete
        value={valueObj || null} // null to make sure the component acts as a controlled component
        onChange={(event, newValue) => {
            if (typeof newValue === 'string') {
                // when the user types in a value that doesn't exist, and hits enter, this triggers.
                // don't create new, and don't select
            } else if (newValue && newValue.inputValue) {
                // Create a new value from the user input
                columnSpec.CreateFromString({ mutation: createMutation, input: newValue.inputValue })
                    .then((updatedObj) => {
                        //showSnackbar({ children: columnSpec.GetCaption({ reason: GetCaptionReasons.AutocompleteCreatedItemSnackbar, obj: updatedObj }), severity: "success" });
                        showSnackbar({ children: columnSpec.NewItemSuccessSnackbarText(updatedObj), severity: "success" });
                        onChange(updatedObj);
                        refetch();
                    }).catch((err => {
                        showSnackbar({ children: columnSpec.NewItemErrorSnackbarText(err), severity: "error" });
                        refetch(); // should revert the data.
                    }));
            } else {
                // user selecting a normal item from the dropdown
                onChange(newValue);
            }
        }}
        filterOptions={(options, params) => {
            const filtered = filterObjects(options, params);
            const { inputValue } = params;
            // Suggest the creation of a new value
            const isExisting = options.some((option) => columnSpec.MatchesExactly(option, inputValue));
            if (inputValue !== '' && !isExisting) {
                filtered.push({ // push vs. unshift; hard to choose really. but adding to end has the advantage that you are encouraged to select existing items, and the auto-highlighted first option is going to be the existing one rather than creating new.
                    inputValue
                });
            }
            return filtered;
        }}
        freeSolo
        autoHighlight={true}
        selectOnFocus
        clearOnBlur
        handleHomeEndKeys
        options={items}
        getOptionLabel={(option) => { // it's not completely clear to me what this is used for, considering we render items ourselves.
            // Value selected with enter, right from the input. docs state that for freesolo this case must be handled.
            if (typeof option === 'string') {
                return option;
            }
            // Add the virtual dynamic option
            if (option.inputValue) {
                return option.inputValue;
            }
            // Regular option
            return columnSpec.GetStringCaptionForValue(option);
        }}
        renderOption={(props, option) => {
            return option.inputValue ?
                (<li {...props}>
                    <AddIcon />
                    <span style={{ fontStyle: "italic" }}>{
                        // "+ Add new role 'power user'"
                        //columnSpec.GetCaption({ reason: GetCaptionReasons.AutocompleteInsertVirtualItemCaption, inputString: option.inputValue });
                        columnSpec.VirtualNewItemText(option.inputValue)
                    }</span>
                </li>) :
                (<li {...props}>
                    {columnSpec.RenderListItemChildren({ obj: option })}
                </li>);
        }}
        renderInput={(params) => (
            // text field with placeholder
            <TextField {...params} label={columnSpec.PlaceholderText()} />
        )}
    />
    );
};



