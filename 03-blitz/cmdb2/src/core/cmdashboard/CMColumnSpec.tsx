

export enum GetCaptionReasons {
    AutocompleteCreatedItemSnackbar = "AutocompleteCreatedItemSnackbar",
    AutocompleteInsertErrorSnackbar = "AutocompleteInsertErrorSnackbar",
    AutocompleteInsertVirtualItemCaption = "AutocompleteInsertVirtualItemCaption",
    AutocompletePlaceholderText = "AutocompletePlaceholderText",
};

export type GetCaptionParams<T> = {
    reason: GetCaptionReasons,
    obj?: T,
    err?: any,
    inputString?: string,
};

export type CMColumnSpec<T> = {
    GetAllItemsQuery: any, // returns all items
    CreateFromStringMutation: any, // allows creating from a single string value
    GetCaption: (params: GetCaptionParams<T>) => string;
};


