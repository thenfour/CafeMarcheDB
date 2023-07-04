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

export interface CMAutocompleteFieldSpec<TDBModel> {
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

export interface CMSelectItemDialogSpec<TDBModel> {
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

export interface CMNewItemDialogFieldSpec<TFieldModel> {
    RenderInputField: (params: CMNewItemDialogFieldSpecParams<TFieldModel>) => any; // react component
    MemberName: string;
    IsForeignObject: boolean;
    FKIDMemberName?: string, // corresponding ID field of the fk. so on user table this is 'roleId'
    GetIDOfFieldValue?: (value?: TFieldModel | undefined) => (number | null),
};

export interface CMNewItemDialogSpec<TDBModel> {
    InitialObj: any;
    ZodSchema: z.ZodObject<any>;
    Fields: CMNewItemDialogFieldSpec<any>[];

    DialogTitle: () => string;
};


export interface CMGridEditCellSpec<TDBModel> {
    PKIDMemberName: string, // field name of the primary key ... almost always this should be "id"
    ForeignPKIDMemberName: string, // field name of the pk of the foreign object. also almost always 'id'
    FKObjectMemberName: string, // the field name of the object, if this is a foreign key. so on the user table, this is 'role' -- the foreign role object
    FKIDMemberName: string, // corresponding ID field of the fk. so on user table this is 'roleId'
    GetIDOfFieldValue?: (value?: TDBModel | undefined) => (number | null),
    RenderItem: (params: RenderItemParams<TDBModel>) => any, // return react component

    SelectItemDialogSpec: CMSelectItemDialogSpec<TDBModel>,
};

// determines behavior
export enum CMEditGridColumnType {
    ForeignObject = "ForeignObject",
    PK = "PK",
    String = "String",
};

export interface CMEditGridColumnSpec {
    Behavior: CMEditGridColumnType,
    MemberName: string,
    HeaderText: string,
    Editable: boolean,
    Width: number,

    FKIDMemberName?: string, // "roleId"
    FKRenderViewCell?: (params: RenderItemParams<any>) => any,// for foreign objects, render the view cell (react component)
    FKEditCellSpec?: CMGridEditCellSpec<any>, // spec for foreign objects only
};


export function CreateEditGridColumnSpec(values: Partial<CMEditGridColumnSpec> & { MemberName: string }): CMEditGridColumnSpec {
    return {
        ...{
            Behavior: CMEditGridColumnType.PK,
            HeaderText: values.MemberName,
            Editable: false,
            Width: 150,
        },
        ...values
    };
}

export interface CMEditGridSpec<TDBModel> {
    PKIDMemberName: string, // field name of the primary key ... almost always this should be "id"

    CreateMutation: any,
    GetPaginatedItemsQuery: any,
    UpdateMutation: any, // support editing of grid columns
    DeleteMutation: any, // by pk alone

    PageSizeOptions: number[],
    PageSizeDefault: number,

    ComputeDiff: (oldItem: TDBModel, newItem: TDBModel) => any, // return an array of changes made. must be falsy if equal
    GetQuickFilterWhereClauseExpression: (query: string) => any[], // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]

    CreateSuccessSnackbar: (item: TDBModel) => string,
    CreateErrorSnackbar: (err: any) => string,
    UpdateItemSuccessSnackbar: (updatedItem: TDBModel) => string,
    UpdateItemErrorSnackbar: (err: any) => string,
    NoChangesMadeSnackbar: (item: TDBModel) => string, //  "No changes were made"
    DeleteConfirmationMessage: (item: TDBModel) => string, // Pressing 'Yes' will delete this row with name {row.name}.
    UpdateConfirmationMessage: (oldItem: TDBModel, newItem: TDBModel, mutation: any[]) => string,
    DefaultOrderBy: any,// { id: "asc" }

    NewItemDialogSpec: CMNewItemDialogSpec<TDBModel>,

    Columns: CMEditGridColumnSpec[],
};
