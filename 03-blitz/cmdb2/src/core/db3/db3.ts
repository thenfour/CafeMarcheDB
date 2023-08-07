// so i am running into a problem where types are all messy because
// i'm trying to keep things together, but everything is dynamically created at runtime so
// there's no way to keep track of types.

// all these update/orderby/include etc are pretty much useless anyway; they always
// get coerced so no type checking is actually done, and intellisense has no context for them either.
// so really what's the point?

import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { KeysOf } from "shared/utils";

////////////////////////////////////////////////////////////////
// the mutation needs to be able to access the xtable in order to
// validate etc.
export interface MutatorInput<UpdateModel> {
    tableName: string;
    deleteId?: number;
    insertModel?: UpdateModel;
    updateModel?: UpdateModel;
};

////////////////////////////////////////////////////////////////
export interface PaginatedQueryInput<WhereInput, OrderByInput> {
    tableName: string;
    skip: number;
    take: number;
    where: WhereInput;
    orderBy: OrderByInput;
};

////////////////////////////////////////////////////////////////
export interface QueryInput<WhereInput, OrderByInput> {
    tableName: string;
    where: WhereInput;
    orderBy: OrderByInput;
};

////////////////////////////////////////////////////////////////
export interface ValidateAndParseResult<FieldType> {
    success: boolean;
    errorMessage?: string;
    parsedValue: FieldType; // implementer should set this to the value to be actually used (after zod parse)
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

    hasErrorForField = (key: string): boolean => {
        const ret = (!this.success && !!this.errors[key]);
        return ret;
    };
    getErrorForField = (key: string): (string | null) => {
        if (this.success) return null;
        return this.errors[key]!;
    };
}

export const EmptyValidateAndComputeDiffResult: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({});


////////////////////////////////////////////////////////////////
// export interface IField<FieldDataType> {
//     fieldType: string,
//     member: string,
//     cellWidth: number,
//     label: string,
//     isEditableInGrid: boolean,
//     defaultValue: FieldDataType | null,

//     initField: <RowModel, >(table: xTable<RowModel>) => void, // field child classes impl this to get established. for example pk fields will set the table's pk here.
// };

export abstract class FieldBase<FieldDataType>/* implements IField<FieldDataType> */ {
    fieldType: string;
    member: string;
    cellWidth: number;
    label: string;
    isEditableInGrid: boolean;
    defaultValue: FieldDataType | null;

    abstract initField: <RowModel, U, W, O, I >(table: xTable<RowModel, U, W, O, I>, fieldName: string) => void; // field child classes impl this to get established. for example pk fields will set the table's pk here.
}

export interface SortModel {
    field: string,
    order: "asc" | "desc",
};

export interface TableDesc<RowModel, TInclude> {
    tableName: string;
    columns: { [key: string]: FieldBase<any> };
    localInclude: TInclude,
    updatePermission: Permission;
    deletePermission: Permission;
    insertPermission: Permission;
    queryPermission: Permission;
};

// we don't care about createinput, because updateinput is the same thing with optional fields so it's a bit too redundant.
export class xTable<RowModel, UpdateInput, WhereInput, OrderByInput, TInclude> implements TableDesc<RowModel, TInclude> {
    tableName: string;
    columns: { [key: string]: FieldBase<any> };

    defaultObject: RowModel;
    pkMember: string;
    localInclude: TInclude;

    updatePermission: Permission;
    deletePermission: Permission;
    insertPermission: Permission;
    queryPermission: Permission;

    constructor(args: TableDesc<RowModel, TInclude>) {
        Object.assign(this, args);

        this.defaultObject = Object.fromEntries(Object.entries(args.columns).map(([fieldName, field]) => {
            return [fieldName, field.defaultValue];
        })) as RowModel; // OOH YEA TYPESCRIPT GOGO

        for (const [fieldName, field] of Object.entries(args.columns)) {
            field.initField(this, fieldName);
        }
    }

    // even for create, validate against the updateinput, which is the same as create input but optional fields.
    ValidateAndComputeDiff = (oldItem: UpdateInput, newItem: UpdateInput): ValidateAndComputeDiffResult => {
        // todo
        return EmptyValidateAndComputeDiffResult;
    };
}

////////////////////////////////////////////////////////////////
// field types
export const FieldTypes = {
    PK: "PK",
    GenericString: "GenericString",
    ForeignSingleSelect: "ForeignSingleSelect",
};

export class PKField extends FieldBase<number> {
    constructor() {
        super();
        this.fieldType = FieldTypes.PK;
        this.isEditableInGrid = false;
        this.cellWidth = 50;
        this.defaultValue = null;
    }

    initField = <RowModel,>(table: xTable<RowModel>, fieldName: string) => {
        this.member = fieldName;
        this.label = fieldName;
        table.pkMember = fieldName;
    }; // field child classes impl this to get established. for example pk fields will set the table's pk here.
}

export interface GenericStringFieldArgs {
    caseSensitive: boolean,
    minLength: number,
};

export class GenericStringField extends FieldBase<string> {
    constructor(args: GenericStringFieldArgs) {
        super();
        this.fieldType = FieldTypes.PK;
        this.isEditableInGrid = false;
        this.cellWidth = 50;
        this.defaultValue = null;
        Object.assign(this, args);
    }

    initField = <RowModel,>(table: xTable<RowModel>, fieldName: string) => {
        this.member = fieldName;
        this.label = fieldName;
        table.pkMember = fieldName;
    }; // field child classes impl this to get established. for example pk fields will set the table's pk here.
};

// // support null even if the db column doesn't, for flexibility. null checking will be done in validation
// export const GenericStringField = (args: GenericStringFieldArgs): FieldBase<string> => {
//     return {
//         fieldType: FieldTypes.GenericString,
//     };
// }

// export interface ForeignSingleSelectFieldArgs {
//     allowNull: boolean;
// };

// export const ForeignSingleSelectField = <ForeignModel>(args: ForeignSingleSelectFieldArgs): FieldBase<ForeignModel> => {
//     //
// };

////////////////////////////////////////////////////////////////
//import { Instrument } from "db";

// unfortunately i don't see a way to deduce the query return payload. that will just need to be specified.
// export const xInstrumentInclude: Prisma.InstrumentInclude = {
//     functionalGroup: true,
//     instrumentTags: {
//         include: { tag: true }
//     }
// };

// describes the payload coming from the db, from this model's perspective.
// must match the way queries / mutations automatically return the object; ideally this would be deduced but if it's possible at all it's not practical.
// export type xInstrumentInclude = {
//     functionalGroup: true,
//     instrumentTags: {
//         include: { tag: true }
//     }
// };

const InstrumentLocalInclude: Prisma.InstrumentInclude = {
    functionalGroup: true,
    instrumentTags: {
        include: { tag: true }
    }
};

//export type xInstrumentPayload = typeof InstrumentLocalInclude;
//export type xInstrumentInsertPayload = Prisma.InstrumentCreateInput;

//db.instrument.create({});

export const xInstrument = new xTable/*<
    Prisma.InstrumentGetPayload<{ include: typeof InstrumentLocalInclude }>,
    Prisma.InstrumentUncheckedUpdateInput,
    Prisma.InstrumentWhereInput,
    Prisma.InstrumentOrderByWithRelationInput,
    Prisma.InstrumentInclude
>*/({
    updatePermission: Permission.admin_general,
    deletePermission: Permission.admin_general,
    insertPermission: Permission.admin_general,
    queryPermission: Permission.view_general_info,
    localInclude: InstrumentLocalInclude,
    tableName: "instrument",
    columns: {
        id: new PKField(),
        name: new GenericStringField({
            caseSensitive: true,
            minLength: 1,
        }),
    }
});

export const gAllTables: { [key: string]: xTable<unknown, unknown, unknown, unknown, unknown> } = {
    instrument: xInstrument,
};

// todo: assert that keys / tablenames are the same
