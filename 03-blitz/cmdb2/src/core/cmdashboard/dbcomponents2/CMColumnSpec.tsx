// multi foregin items selection dialog
// multi foreign items on new

// validation errors from select item dialog break things on grid (editing when not in edit mode?)
// select item dialog is changing height all the time
// select item dialog should have a clear filter x
// select item dialog performs validation or not? (nullable)
// hitting enter on select item dlg broken

import { GridColDef, GridPreProcessEditCellProps, GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React from "react";
import { ZodSchema, z } from "zod";
import { CMTextField } from "../CMTextField";

// base specs for specifying db object behaviors //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface ValidateAndParseResult {
    success: boolean;
    errorMessage?: string;
    parsedValue: any; // implementer should set this to the value to be actually used (after zod parse)
};

export interface ValidateAndComputeDiffResultFields {
    success: boolean;
    errors: { [key: string]: string };
    hasChanges: boolean; // only meaningful if success
    changes: { [key: string]: [any, any] }; // only meaningful if success
};

export class ValidateAndComputeDiffResult implements ValidateAndComputeDiffResultFields {
    success: boolean = true;
    errors: { [key: string]: string } = {};
    hasChanges: boolean = false; // only meaningful if success
    changes: { [key: string]: [any, any] } = {}; // only meaningful if success

    constructor(args: Partial<ValidateAndComputeDiffResultFields>) {
        Object.assign(this, args);
    }

    hasErrorForField = (key: string) => {
        const ret = (!this.success && !!this.errors[key]);
        return ret;
    };
}

export const EmptyValidateAndComputeDiffResult: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({});

export interface NewDialogAPI {
    setFieldValues: (fieldValues: { [key: string]: any }) => void,
};

export interface RenderForNewItemDialogArgs<DBModel> {
    key: any;
    obj: DBModel,
    value: any;
    validationResult: ValidateAndComputeDiffResult;
    api: NewDialogAPI,
};

export abstract class CMFieldSpecBase<DBModel> {
    member: string; // the member corresponds to the conceptual value. so for FK, it's the OBJECT member, not the ID member (e.g. user, not userId).
    fkidMember?: string; // if this is a one-to-* foreign key, this is the id (e.g. userId). This is required in the generic base because validation supports FK.
    columnHeaderText: string;

    initialNewItemValue: any;
    zodSchema: null | ZodSchema; // todo: possibly different schemas for different scenarios. in-grid editing vs. new item dialog etc.

    // determines a few things:
    // 1. does it enable editing behavior in the grid?
    // 2. does it participate in update mutations?
    isEditableInGrid: boolean;
    cellWidth: number;

    GridColProps!: Partial<GridColDef>;

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    abstract ValidateAndParse: (val: any) => ValidateAndParseResult;

    renderForEditGridView?: (params: GridRenderCellParams) => React.ReactElement;
    renderForEditGridEdit?: (params: GridRenderEditCellParams) => React.ReactElement;
    renderForNewDialog?: (params: RenderForNewItemDialogArgs<DBModel>) => React.ReactElement; // will render as a child of <FormControl>

    // returns whether the two values are considered equal (and thus the row has been modified).
    // should use the schema to validate both sides. there is an assumption that the fields have passed validation, and the sanitized versions are passed in.
    // there is another assumption that the input values are not null-y. the caller checks that condition already.
    abstract isEqual: (lhsRow: DBModel, rhsRow: DBModel/*, lhsFKID?: number, rhsFKID?: number*/) => boolean;

    // return either falsy, or an object like { name: { contains: query } }
    abstract getQuickFilterWhereClause: (query: string) => any;
};

// local fields //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

interface PKIDFieldArgs {
    member: string,
};

export class PKIDField<DBModel> extends CMFieldSpecBase<DBModel> {

    args: PKIDFieldArgs;

    constructor(args: PKIDFieldArgs) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = undefined;

        this.columnHeaderText = args.member;
        this.isEditableInGrid = false;
        this.cellWidth = 40;
    }

    ValidateAndParse = (val: any) => {
        throw new Error(`pkid is not editable`);
    }

    isEqual = (lhsSanitizedFieldValue: any, rhsSanitizedFieldValue: any) => {
        return (lhsSanitizedFieldValue as number) === (rhsSanitizedFieldValue as number);
    };

    getQuickFilterWhereClause = (query: string) => {
        return false;
    }; // return either falsy, or an object like { name: { contains: query } }
};

interface SimpleTextFieldArgs {
    member: string,
    label: string,
    cellWidth: number,
    initialNewItemValue: string;
    zodSchema: ZodSchema; // todo: possibly different schemas for different scenarios. in-grid editing vs. new item dialog etc.
    // for things like treating empty as null, case sensitivity, trimming, do it in the zod schema via transform
};

export class SimpleTextField<DBModel> extends CMFieldSpecBase<DBModel> {

    args: SimpleTextFieldArgs;

    constructor(args: SimpleTextFieldArgs) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = undefined;
        this.columnHeaderText = args.member;
        this.isEditableInGrid = true;
        this.cellWidth = args.cellWidth;
        this.initialNewItemValue = args.initialNewItemValue;
        this.zodSchema = args.zodSchema;
    }

    GridColProps = {
        type: "string",
        preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
            const parseResult = this.ValidateAndParse(params.props.value);
            return { ...params.props, error: !parseResult.success };
        }
    };

    renderForNewDialog = (params: RenderForNewItemDialogArgs<DBModel>) => {
        return <CMTextField
            key={params.key}
            autoFocus={false}
            label={this.args.label}
            validationError={params.validationResult.hasErrorForField(this.args.member)}
            value={params.value}
            onChange={(e, val) => {
                //return onChange(val);
                params.api.setFieldValues({ [this.args.member]: val });
            }}
        />;
    };

    ValidateAndParse = (val: any): ValidateAndParseResult => {
        if (!this.zodSchema) {
            // no schema = no validation
            return {
                parsedValue: val,
                success: true,
                errorMessage: "",
            };
        }
        const parseResult = this.zodSchema.safeParse(val) as any; // for some reason some fields are missing from the type, so cast as any.
        const ret: ValidateAndParseResult = {
            success: parseResult.success,
            errorMessage: parseResult.error && parseResult.error.flatten().formErrors.join(", "),
            parsedValue: parseResult.data,
        };
        return ret;
    }

    isEqual = (lhsSanitizedFieldValue: any, rhsSanitizedFieldValue: any) => {
        return (lhsSanitizedFieldValue as string) === (rhsSanitizedFieldValue as string);
    };

    getQuickFilterWhereClause = (query: string) => {
        const obj = {};
        obj[this.member] = { contains: query };
        return obj;
    }; // return either falsy, or an object like { name: { contains: query } }

};



export class CMTableSpecRequiredValues<DBModel> {
    fields: CMFieldSpecBase<DBModel>[];
    devName: string;
    CreateMutation: any;
    CreateSchema: z.ZodObject<any>; // hm is this necessary?
    GetPaginatedItemsQuery: any;
    UpdateMutation: any;
    UpdateSchema: z.ZodObject<any>;
    DeleteMutation: any;
    GetNameOfRow: (row: DBModel) => string;
};

// default implementations of stuff. could i just make an abstract base class and not bother with the interface? probably
export class CMTableSpec<DBModel> extends CMTableSpecRequiredValues<DBModel> {// implements ITableSpec<DBModel> {
    PageSizeOptions = [20, 50, 100] as number[];
    PageSizeDefault = 50 as number;
    DefaultOrderBy = { id: "asc" } as any;
    initialObj = {} as DBModel; // yes this breaks typing but will be populated in a bit.

    PKIDMemberName = "id" as string; // field name of the primary key ... almost always this should be "id"

    constructor(reqValues: CMTableSpecRequiredValues<DBModel>, overrides?: Partial<CMTableSpec<DBModel>>) {
        super();
        Object.assign(this, reqValues);
        if (!!overrides) Object.assign(this, overrides);
        for (let i = 0; i < this.fields.length; ++i) {
            const field = this.fields[i]!;
            this.initialObj[field.member] = field.initialNewItemValue;
        }
    }

    CreateItemButtonText = () => `New ${this.devName}`;
    NewItemDialogTitle = () => `New ${this.devName}`;
    CreateSuccessSnackbar = (item: DBModel) => `${this.devName} added: ${this.GetNameOfRow(item)} `;
    CreateErrorSnackbar = (err: any) => `Server error while adding ${this.devName} `;
    UpdateItemSuccessSnackbar = (updatedItem: DBModel) => `${this.devName} ${this.GetNameOfRow(updatedItem)} updated.`;
    UpdateItemErrorSnackbar = (err: any) => `Server error while updating ${this.devName} `;
    DeleteItemSuccessSnackbar = (updatedItem: DBModel) => `deleted ${this.devName} success`;
    DeleteItemErrorSnackbar = (err: any) => `deleted ${this.devName} error`;
    NoChangesMadeSnackbar = (item: DBModel) => "No changes were made";
    DeleteConfirmationMessage = (item: DBModel) => `Pressing 'Yes' will delete ${this.devName} '${this.GetNameOfRow(item)}'`;
    UpdateConfirmationMessage = (oldItem: DBModel, newItem: DBModel, validateResult: ValidateAndComputeDiffResult) => `Pressing 'Yes' will update ${this.devName} ${this.GetNameOfRow(oldItem)} `;

    // returns an object describing changes and validation errors.
    ValidateAndComputeDiff(oldItem: DBModel, newItem: DBModel): ValidateAndComputeDiffResult {
        const ret: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({
            changes: {},
            errors: {},
            success: true,
            hasChanges: false,
        });
        for (let i = 0; i < this.fields.length; ++i) {
            const field = this.fields[i]!;
            if (!field.isEditableInGrid) {
                continue;
            }
            const a = oldItem[field.member];
            const b_raw = newItem[field.member];
            const b_parseResult = field.ValidateAndParse(b_raw); // because `a` comes from the db, it's not necessary to validate it for the purpose of computing diff.

            if (!b_parseResult.success) {
                ret.success = false;
                ret.errors[field.member] = b_parseResult.errorMessage!;
                continue;
            }
            const b = b_parseResult.parsedValue;

            const a_isNully = ((a === null) || (a === undefined));
            const b_isNully = ((b === null) || (b === undefined));
            if (a_isNully !== b_isNully) {
                // one is null, other is not. guaranteed 
                ret.hasChanges = true;
                ret.changes[field.member] = [a, b];
            }

            // in order to support fk, we should also pass in the fkid members.
            if (field.fkidMember) {
                if (!field.isEqual(a, b)) {
                    ret.hasChanges = true;
                    ret.changes[field.member] = [a, b];
                    const a_fkid = oldItem[field.fkidMember];
                    const b_fkid = newItem[field.fkidMember];
                    ret.changes[field.fkidMember] = [a_fkid, b_fkid];
                }
            } else {
                if (!field.isEqual(a, b)) {
                    ret.hasChanges = true;
                    ret.changes[field.member] = [a, b];
                }
            }
        }

        return ret;
    };

    GetQuickFilterWhereClauseExpression = (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
        const ret = [] as any[];
        for (let i = 0; i < this.fields.length; ++i) {
            const field = this.fields[i]!;
            const clause = field.getQuickFilterWhereClause(query);
            if (clause) {
                ret.push(clause);
            }
        }
        return ret;
    };
};












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
