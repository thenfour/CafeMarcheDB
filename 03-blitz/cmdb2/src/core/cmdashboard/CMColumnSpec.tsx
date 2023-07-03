

export enum GetCaptionReasons {
    AutocompleteCreatedItemSnackbar = "AutocompleteCreatedItemSnackbar",
    AutocompleteInsertErrorSnackbar = "AutocompleteInsertErrorSnackbar",
    AutocompleteInsertVirtualItemCaption = "AutocompleteInsertVirtualItemCaption",
    AutocompletePlaceholderText = "AutocompletePlaceholderText",
    SelectItemDialogTitle = "SelectItemDialogTitle",
};

export type GetCaptionParams<T> = {
    reason: GetCaptionReasons,
    obj?: T | null,
    err?: any,
    inputString?: string,
};

export type RenderItemParams<T> = {
    value?: T | null,
    onClick?: (value?: T | null) => void,
    onDelete?: (value?: T | null) => void,
};

export type CreateFromStringParams<T> = {
    mutation: any,
    input: string,
};

export type CMColumnSpec<T> = {
    IsEqual: (item1: T | undefined | null, item2: T | undefined | null) => boolean;
    MatchesExactly: (value: T, input: string) => boolean; // used by autocomplete to know if the item created by single text string already exists
    GetStringCaptionForValue: (value: T) => string; // not clear why autocomplete needs this but it does.
    GetAllItemsQuery: any, // returns all items
    CreateFromStringMutation: any, // allows creating from a single string value
    CreateFromString: (params: CreateFromStringParams<T>) => Promise<T>, // create an object from string asynchronously.
    GetCaption: (params: GetCaptionParams<T>) => string,
    RenderAutocompleteItem: ({ obj }: { obj: T }) => any, // return react component
    RenderItem: (params: RenderItemParams<T>) => any, // return react component
    RenderSelectListItemChildren: (value: T) => any, // react component; render the item in a select dialog
};


