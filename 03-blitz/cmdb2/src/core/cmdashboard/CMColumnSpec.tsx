import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { z } from "zod"

// single item support (*-to-one relation) //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
    RenderListItemChild: ({ obj }: { obj: TDBModel }) => React.ReactElement, // return react component

    NewItemSuccessSnackbarText: (obj: TDBModel) => string;
    NewItemErrorSnackbarText: (err: any) => string;
    VirtualNewItemText: (inputText: string) => string;
    PlaceholderText: () => string;
};

export interface CMSelectItemDialogSpec<TDBModel> {
    GetAllItemsQuery: any, // returns all items
    CreateFromStringMutation: any, // allows creating from a single string value
    CreateFromString: ((params: CreateFromStringParams<TDBModel>) => Promise<TDBModel>), // create an object from string asynchronously.
    RenderListItemChild: (value: TDBModel) => React.ReactElement, // react component; render the item in a select dialog
    IsEqual: (item1: TDBModel | undefined | null, item2: TDBModel | undefined | null) => boolean;
    RenderItem: (params: RenderItemParams<TDBModel>) => React.ReactElement, // return react component
    GetQuickFilterWhereClauseExpression: (query: string) => any[], // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]

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
    RenderInputField: (params: CMNewItemDialogFieldSpecParams<TFieldModel>) => React.ReactElement; // react component
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
    ForeignPKIDMemberName: string, // field name of the pk of the foreign object. also almost always 'id'
    FKObjectMemberName: string, // the field name of the object, if this is a foreign key. so on the user table, this is 'role' -- the foreign role object
    FKIDMemberName: string, // corresponding ID field of the fk. so on user table this is 'roleId'
    GetIDOfFieldValue?: (value?: TDBModel | undefined) => (number | null),
    RenderItem: (params: RenderItemParams<TDBModel>) => React.ReactElement, // return react component

    SelectItemDialogSpec: CMSelectItemDialogSpec<TDBModel>,
};

// MULTI ITEM SUPPORT ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// for rendering multiple items (tags?) in a *-to-many relation.
export type RenderMultiItemParams<TRow, TAssociation> = {
    rowObject: TRow,
    value: TAssociation[],
    onDelete?: (value: TAssociation) => void,
};

export type CreateAssociationWithNewForeignObjectFromStringParams<TRow/*, TAssociation, TForeignModel*/> = {
    rowObject: TRow,
    mutation: any,
    input: string,
};

export type RenderListItemParams<TRow, TAssociation> = {
    rowObject: TRow,
    value: TAssociation,
    selected: boolean,
};

export type GetAllForeignItemOptionsAsAssociationsParams<TRow, TAssociation> = {
    rowObject: TRow,
    existingAssociations: TAssociation[],
    where: any,
};

export type GetAllForeignItemOptionsAsAssociationsResult<TRow, TAssociation> = {
    items: TAssociation[],
    refetch: any, // callable from useQuery().
};

// you are selecting TForeignModel, but the incoming value is a TAssociation[]
export interface CMSelectMultiDialogSpec<TRow, TAssociation> {
    GetAllForeignItemOptionsAsAssociations: (params: GetAllForeignItemOptionsAsAssociationsParams<TRow, TAssociation>) => GetAllForeignItemOptionsAsAssociationsResult<TRow, TAssociation>,

    CreateForeignFromStringMutation: any, // allows creating a TForeignModel from a single string value
    CreateAssociationWithNewForeignObjectFromString: (params: CreateAssociationWithNewForeignObjectFromStringParams<TRow>) => Promise<TAssociation>;
    RenderListItemChild: (params: RenderListItemParams<TRow, TAssociation>) => React.ReactElement, // react component; render the item in a select dialog
    RenderValue: (params: RenderMultiItemParams<TRow, TAssociation>) => React.ReactElement, // for rendering the current value (TAssociation[]). return react component
    GetQuickFilterWhereClauseExpression: (query: string) => any[], // where clause for FOREIGN items. takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
    IsEqualAssociation: (item1: TAssociation | undefined | null, item2: TAssociation | undefined | null) => boolean;
    GetKey: (value: TAssociation) => any; // for react list keys

    NewItemSuccessSnackbarText: (obj: TAssociation) => string;
    NewItemErrorSnackbarText: (err: any) => string;
    DialogTitleText: () => string;
    NewItemText: (inputText: string) => string;
};


export type RenderItemOfMultiParams<TRow, TAssociation> = {
    row: TRow,
    value: TAssociation[],
    onDelete?: (value: TAssociation) => void,
};

export type CMGridEditCellMultiFKProps<TRow, TForeignModel> = {
    localObject: TRow,
    foreignObject?: TForeignModel | null;
};

export interface CMGridEditCellMultiFKSpec<TRow, TAssociation> {
    RenderEditCellValue: (params: RenderItemOfMultiParams<TRow, TAssociation>) => React.ReactElement, // render all items
    SelectMultiDialogSpec: CMSelectMultiDialogSpec<TRow, TAssociation>,
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// determines behavior
export enum CMEditGridColumnType {
    ForeignObject = "ForeignObject",
    PK = "PK", // non-editable, integral, maybe hidden by default?
    String = "String", // simple one-liner string.
    MultiForeignObjects = "MultiForeignObjects",
    Custom = "Custom", // spec renders by itself
    UInt16 = "UInt16",
    // datetime
    // multiline text
    // boolean
};

export interface CMEditGridColumnSpec {
    Behavior: CMEditGridColumnType,
    MemberName: string,
    HeaderText: string,
    Editable: boolean,
    Width: number,

    FKIDMemberName?: string, // "roleId"
    FKRenderViewCell?: (params: RenderItemParams<any>) => React.ReactElement,// for foreign objects (single or multi) render the view cell (react component)
    FKEditCellSpec?: CMGridEditCellSpec<any>, // spec for SINGLE foreign objects
    FKEditCellMultiSpec?: CMGridEditCellMultiFKSpec<any, any>, // spec for MULTI foreign objects

    GridColProps?: Partial<GridColDef>; // additional props to add to the mui datagrid column def. for custom cell types probably you want to add your own rendering here.
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

    CreateItemButtonText: () => string,
    CreateSuccessSnackbar: (item: TDBModel) => string,
    CreateErrorSnackbar: (err: any) => string,
    UpdateItemSuccessSnackbar: (updatedItem: TDBModel) => string,
    UpdateItemErrorSnackbar: (err: any) => string,

    DeleteItemSuccessSnackbar: (updatedItem: TDBModel) => string,
    DeleteItemErrorSnackbar: (err: any) => string,

    NoChangesMadeSnackbar: (item: TDBModel) => string, //  "No changes were made"
    DeleteConfirmationMessage: (item: TDBModel) => string, // Pressing 'Yes' will delete this row with name {row.name}.
    UpdateConfirmationMessage: (oldItem: TDBModel, newItem: TDBModel, mutation: any[]) => string,
    DefaultOrderBy: any,// { id: "asc" }

    NewItemDialogSpec: CMNewItemDialogSpec<TDBModel>,

    Columns: CMEditGridColumnSpec[],
};

// export interface CMAssociationMatrixSpecCellClickHandlerParams<Tx, TAssociation, Ty> {
// };

export interface CMAssociationMatrixSpecColumnPropsParams<Tx, TAssociation, Ty> {
    // if you want to have a toggle on-off sort of thing,
    handleClick_simpleToggle: (params: GridRenderCellParams) => void,
};

// all 3 template params are DB Model objects.
// X and Y types are column/row respectively.
export interface CMAssociationMatrixSpec<Tx, TAssociation, Ty> {
    PageSizeOptions: number[], // [20,50,100]
    PageSizeDefault: number, // 50
    DefaultOrderBy: any,// { id: "asc" }

    ToggleMutation: any,

    GetQuickFilterWhereClauseExpression: (query: string) => any[], // for filtering rows (Ty) takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]

    // CreateMutation: any,
    GetPaginatedRowsIncludingAssociationsQuery: any, // a query that, when queried, returns [{ rows, count, columns }, { refetch: refetchRows }]. Rows must have fields per column (key: id), and values which are association model objects. `Columns` does not need to include sub objects.
    GetRowFieldForColumn: (obj: Tx) => string, // 
    GetColumnHeading: (obj: Tx) => string,
    RowPKField: string,
    RowNameField: string,
    GetGridColumnProps: (obj: Tx, params: CMAssociationMatrixSpecColumnPropsParams<Tx, TAssociation, Ty>) => Partial<GridColDef>;

    ToggleSuccessSnackbar: (oldObj: TAssociation | null, newObj: TAssociation | null) => string,
    ToggleErrorSnackbar: (err: any) => string,
};
