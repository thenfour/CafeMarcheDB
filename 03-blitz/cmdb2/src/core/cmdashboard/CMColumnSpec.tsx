import { z } from "zod"

export type RenderItemParams<T> = {
    value?: T | null,
    onClick?: (value?: T | null) => void,
    onDelete?: (value?: T | null) => void,
};

export type CreateFromStringParams<T> = {
    mutation: any,
    input: string,
};

export type CMAutocompleteFieldSpec<TDBModel> = {
    GetAllItemsQuery: any, // returns all items
    CreateFromStringMutation: any, // allows creating from a single string value
    CreateFromString: ((params: CreateFromStringParams<TDBModel>) => Promise<TDBModel>), // create an object from string asynchronously.
    MatchesExactly: (value: TDBModel, input: string) => boolean; // used by autocomplete to know if the item created by single text string already exists
    GetStringCaptionForValue: (value: TDBModel) => string; // not clear why autocomplete needs this but it does.
    IsEqual: (item1: TDBModel | undefined | null, item2: TDBModel | undefined | null) => boolean;
    RenderListItemChildren: ({ obj }: { obj: TDBModel }) => any, // return react component

    NewItemSuccessSnackbarText: (obj: TDBModel) => string;
    NewItemErrorSnackbarText: (err: any) => string;
    VirtualNewItemText: (inputText: string) => string;
    PlaceholderText: () => string;
};

export type CMSelectItemDialogSpec<TDBModel> = {
    GetAllItemsQuery: any, // returns all items
    CreateFromStringMutation: any, // allows creating from a single string value
    CreateFromString: ((params: CreateFromStringParams<TDBModel>) => Promise<TDBModel>), // create an object from string asynchronously.
    RenderListItemChildren: (value: TDBModel) => any, // react component; render the item in a select dialog
    IsEqual: (item1: TDBModel | undefined | null, item2: TDBModel | undefined | null) => boolean;
    RenderItem: (params: RenderItemParams<TDBModel>) => any, // return react component

    NewItemSuccessSnackbarText: (obj: TDBModel) => string;
    NewItemErrorSnackbarText: (err: any) => string;
    DialogTitleText: () => string;
    NewItemText: (inputText: string) => string;
};

export type CMGridEditCellSpec<TDBModel> = {
    PKID: string, // field name of the primary key ... almost always this should be "id"
    FKObjectFieldName: string, // the field name of the object, if this is a foreign key. so on the user table, this is 'role' -- the foreign role object
    FKIDFieldName: string, // corresponding ID field of the fk. so on user table this is 'roleId'
    RenderItem: (params: RenderItemParams<TDBModel>) => any, // return react component

    SelectItemDialogSpec: CMSelectItemDialogSpec<TDBModel>,
};

export type CMNewItemDialogSpec<TDBModel> = {
    InitialObj: any;
    ZodSchema: z.ZodObject<any>;
};
