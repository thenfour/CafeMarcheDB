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

export type CMNewItemDialogFieldSpecParams<TFieldModel> = {
    key: string, // react component key
    validationErrors,
    value?: TFieldModel | undefined, // foreign object
    onChange: (fieldValue?: TFieldModel | undefined) => void,
};

export type CMNewItemDialogFieldSpec<TFieldModel> = {
    RenderInputField: (params: CMNewItemDialogFieldSpecParams<TFieldModel>) => any; // react component
    MemberName: string;
    IsForeignObject: boolean;
    FKIDMemberName?: string, // corresponding ID field of the fk. so on user table this is 'roleId'
    GetIDOfFieldValue?: (value?: TFieldModel | undefined) => (number | null),
};

export type CMNewItemDialogSpec<TDBModel> = {
    InitialObj: any;
    ZodSchema: z.ZodObject<any>;
    Fields: CMNewItemDialogFieldSpec<any>[];

    DialogTitle: () => string;
};


export type CMGridEditCellSpec<TDBModel> = {
    PKIDMemberName: string, // field name of the primary key ... almost always this should be "id"
    ForeignPKIDMemberName: string, // field name of the pk of the foreign object. also almost always 'id'
    FKObjectMemberName: string, // the field name of the object, if this is a foreign key. so on the user table, this is 'role' -- the foreign role object
    FKIDMemberName: string, // corresponding ID field of the fk. so on user table this is 'roleId'
    GetIDOfFieldValue?: (value?: TDBModel | undefined) => (number | null),
    RenderItem: (params: RenderItemParams<TDBModel>) => any, // return react component

    SelectItemDialogSpec: CMSelectItemDialogSpec<TDBModel>,
};

export type CMEditGridColumnSpec<TDBModel> = {

};

// export type CMEditGridSpec<TDBModel> = {
//     Columns: [],

// };


// export const CMTextInput<T> = (params: CMNewItemDialogFieldSpecParams<T>) => {
//                     // <CMTextField autoFocus={true} label="Name" validationError={validationErrors["name"]} value={obj["name"]} onChange={(e, val) => {
//                     //     setObj({ ...obj, name: val });
//                     // }}
//                 }

                    // ></CMTextField>
                    // <CMTextField autoFocus={false} label="Email" validationError={validationErrors["email"]} value={obj["email"]} onChange={(e, val) => {
                    //     setObj({ ...obj, email: val });
                    // }}
                    // ></CMTextField>
                    // <CMAutocompleteField<DBRole> columnSpec={RoleAutocompleteSpec} valueObj={obj.role} onChange={(role) => {
                    //     setObj({ ...obj, role, roleId: (role?.id || null) });
                    // }}></CMAutocompleteField>
