
import { TAnyModel } from "@/shared/rootroot";
import { z } from "zod";
import { type ColorPaletteEntry, ColorPaletteList, gGeneralPaletteList } from "../../../components/color/palette";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    type DB3AuthSpec,
    type DB3FieldCodec,
    type DB3MaybeNull,
    type DB3ReadPresenceForAuthSpec,
    type DB3RowMode, ErrorValidateAndParseResult,
    FieldBase, makeNullableReadTransportSchema,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// this field demonstrates the ability to expose raw db values as structures.
// here the db value is a string, but the exposed value is a ColorPaletteEntry.
// 
// this means the datagrid row model has a ColorPaletteEntry, NOT a string. not both.
// this is the gateway to doing foreign key items.
export type ColorFieldArgs<
    TAllowNull extends boolean,
    TAuthSpec extends DB3AuthSpec,
> = {
    columnName: string;
    allowNull: TAllowNull;
    palette: ColorPaletteList;
} & TAuthSpec;

export class ColorField<
    const TAllowNull extends boolean = boolean,
    const TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> extends FieldBase<
    ColorPaletteEntry, // client-facing field datatype
    DB3FieldCodec< // transport codec for converting between DB(DTO) and client representations
        DB3MaybeNull<string, TAllowNull>, // DB representation
        ColorPaletteEntry | null, // client-facing representation, (todo: shall this be DB3MaybeNull?)
        string | null // write transport representation (todo: shall this be DB3MaybeNull?)
    >,
    true, // TClientWritable, indicates if the client can write to this field
    DB3MaybeNull<string, TAllowNull>, // read transport value
    ColorPaletteEntry | null, // client-facing representation
    DB3ReadPresenceForAuthSpec<TAuthSpec> // read presence (whether it can be auth-stripped -> zod schema needs .optional())
> {
    allowNull: boolean;
    palette: ColorPaletteList;

    readonly codec: DB3FieldCodec<
        DB3MaybeNull<string, TAllowNull>,
        ColorPaletteEntry | null,
        string | null
    > = {
            decode: value => this.palette.findEntry(value),
            encode: value => value?.id || null,
            writeSchema: z.string().nullable(),
        };

    constructor(args: ColorFieldArgs<TAllowNull, TAuthSpec>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : args.palette.defaultEntry,
            readTransportSchema: makeNullableReadTransportSchema(z.string(), args.allowNull),
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            specialFunction: SqlSpecialColumnFunction.color,
        });
        this.allowNull = args.allowNull;
        this.palette = args.palette;
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: ColorPaletteEntry, b: ColorPaletteEntry) => {
        return a.id === b.id;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return false;// { [this.member]: { contains: query } };
    };

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel) => { };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        // todo: stop using TAnyModel
        if (dbModel[this.member] === undefined) return;
        const dbVal: string | null = dbModel[this.member];
        clientModel[this.member] = this.codec.decode(
            dbVal as DB3MaybeNull<string, TAllowNull>,
        );
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        if (clientModel[this.member] === undefined) {
            return;
        }
        const val: ColorPaletteEntry | null = clientModel[this.member];
        mutationModel[this.member] = this.codec.encode(val);
    };

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<ColorPaletteEntry>): ValidateAndParseResult<ColorPaletteEntry | null> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();
        if (value === null) {//&& !this.allowNull) {
            if (this.allowNull)
                return SuccessfulValidateAndParseResult(objValue);
            return ErrorValidateAndParseResult("field is required", objValue);
        }
        if (this.palette.findEntry(value?.id || null) == null) {
            return ErrorValidateAndParseResult("Not found in palette.", objValue);
        }
        return SuccessfulValidateAndParseResult(objValue);
    };


    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;
};


// color fields convert to colorpaletteentry on query
export const MakeColorField = <const TAuthSpec extends DB3AuthSpec>(args: { columnName?: string } & TAuthSpec) => (
    new ColorField<true, TAuthSpec>({
        ...args,
        columnName: args.columnName ?? "color",
        allowNull: true,
        palette: gGeneralPaletteList,
    }));
