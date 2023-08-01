import { Prisma } from "db";
import { CMNewItemDialogSpec, CMNewItemDialogFieldSpec, CMEditGridSpec, CreateEditGridColumnSpec, CMEditGridColumnType, CMEditGridColumnSpec, CMFieldSpec, CMTableSpec, SimpleTextField } from "src/core/cmdashboard/CMColumnSpec";
//import { Signup as NewUserSchema } from "src/auth/schemas";
import { CMTextField } from './cmdashboard/CMTextField';
import { CMAutocompleteField } from './cmdashboard/CMAutocompleteField';
import { NewSongSchema } from "./schemas/songSchemas";
//import { RenderRole, RoleAutocompleteSpec, RoleGridEditCellSpec } from './CMDBRole';
//import getUsers from "src/auth/queries/getUsers";
//import updateUserFromGrid from "src/auth/mutations/updateUserFromGrid";
//import SoftDeleteUserMutation from "src/auth/mutations/deleteUser";
//import NewUserMutationSpec from "src/auth/mutations/newUser";

type DBSong = Prisma.SongGetPayload<{
    //includes?
}>;


//////////////////////////////////////////////
// non nullable

// interface NonNullableTextFieldArgs {
//     member: string,
//     label: string,
//     defaultValue?: string,
//     isCaseSensitive?: boolean,
// };

// function NonNullableTextField<DBModel>(args: NonNullableTextFieldArgs): CMFieldSpec<DBModel> {
//     return {
//         member: args.member,
//         isEqual: (lhsFieldValue: any, rhsFieldValue: any) => {
//             const lhsFalse = (lhsFieldValue === null || lhsFieldValue === undefined); // support nullability
//             const rhsFalse = (rhsFieldValue === null || rhsFieldValue === undefined);
//             if (lhsFalse != rhsFalse) return false; // one is null and the other is not.
//             if (args.isCaseSensitive) {
//                 return (lhsFieldValue as string) === (rhsFieldValue as string);
//             }
//             return (lhsFieldValue as string).toLowerCase() === (rhsFieldValue as string).toLowerCase();
//         }, // returns whether the two values are considered equal (and thus the row has been modified).
//         getQuickFilterWhereClause: (query: string) => {
//             const obj = {};
//             obj[args.member] = { contains: query };
//             return obj;
//         }, // return either falsy, or an object like { name: { contains: query } }
//         renderForNewDialog: null,
//         renderForEditGridView: null,
//         renderForEditGridEdit: null,
//     };
// };


// export const SongTable = new CMTableSpec<DBSong>({
//     devName: "song",
//     CreateMutation: null,
//     CreateSchema: null,
//     GetPaginatedItemsQuery: null,
//     UpdateMutation: null,
//     UpdateSchema: null,
//     DeleteMutation: null,
//     GetNameOfRow: (row: DBSong) => { return row.name; },
//     fields: [
//         new SimpleTextField({ label: "", member: "", defaultValue: "", isCaseSensitive: true, treatEmptyAsNull: true, trimWhitespace: true }),
//     ],
// });



// function CreateEditGridColumnSpecFromFieldSpec<DBModel>(field: CMFieldSpec<DBModel>): CMEditGridColumnSpec {
//     // see:
//     //     CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.PK, MemberName: "id", Editable: true, }),
//     //     CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "name", Editable: true, }),
//     //     CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "email", Editable: true, }),
//     //     CreateEditGridColumnSpec({
//     //         Behavior: CMEditGridColumnType.ForeignObject,
//     //         MemberName: "role",
//     //         FKIDMemberName: "roleId",
//     //         FKEditCellSpec: RoleGridEditCellSpec,
//     //         FKRenderViewCell: RenderRole,
//     //         Editable: true,
//     //     }),

// };

// singleForeignObject
// multiForeignObjects
// year
// key

//////////////////////////////////////////////

// const SongModelSpec: CMTableSpec<DBSong> = {
//     devName: "song",
//     CreateMutation: null,
//     GetPaginatedItemsQuery: null,
//     UpdateMutation: null,
//     DeleteMutation: null, // by pk alone
//     GetNameOfRow: (row: DBSong) => { return row.name; },
//     fields: [
//         NonNullableTextField<DBSong>({ member: "name", label: "name" }),
//     ],
// };

// //////////////////////////////////////////////

// function GenerateNewItemDialogSpec<DBModel>(table: CMTableSpec): CMNewItemDialogSpec<DBModel> {
//     return {};
// }


// //////////////////////////////////////////////

// function GenerateEditGridSpec<DBModel>(table: CMTableSpec<DBModel>): CMEditGridSpec<DBModel> {
//     return {
//         PKIDMemberName: "id", // field name of the primary key ... almost always this should be "id"
//         DefaultOrderBy: { id: "asc" },
//         PageSizeOptions: [3, 25, 100],
//         PageSizeDefault: 25,

//         CreateMutation: table.CreateMutation,
//         GetPaginatedItemsQuery: table.GetPaginatedItemsQuery,
//         UpdateMutation: table.UpdateMutation, // support editing of grid columns
//         DeleteMutation: table.DeleteMutation, // by pk alone

//         CreateItemButtonText: () => `New ${table.devName}`,
//         CreateSuccessSnackbar: (item: DBModel) => `${table.devName} added: ${table.GetNameOfRow(item)}`,
//         CreateErrorSnackbar: (err: any) => `Server error while adding ${table.devName}`,
//         UpdateItemSuccessSnackbar: (updatedItem: DBModel) => `${table.devName} ${table.GetNameOfRow(updatedItem)} updated.`,
//         UpdateItemErrorSnackbar: (err: any) => `Server error while updating ${table.devName}`,
//         DeleteItemSuccessSnackbar: (updatedItem: DBModel) => `deleted ${table.devName} success`,
//         DeleteItemErrorSnackbar: (err: any) => `deleted ${table.devName} error`,
//         NoChangesMadeSnackbar: (item: DBModel) => "No changes were made",
//         DeleteConfirmationMessage: (item: DBModel) => `Pressing 'Yes' will delete ${table.devName} '${table.GetNameOfRow(item)}'`,
//         UpdateConfirmationMessage: (oldItem: DBModel, newItem: DBModel, mutation: any) => `Pressing 'Yes' will update ${table.devName} ${table.GetNameOfRow(oldItem)}`,

//         ComputeDiff: (oldItem: DBModel, newItem: DBModel) => { // return an object describing changes made, like { name: {a:"",b:""}, description: {a:"", b:""} }. returns false if equal
//             let hasChanges = false;
//             const ret = {};
//             for (let i = 0; i < table.fields.length; ++i) {
//                 const field = table.fields[i]!;
//                 const a = oldItem[field.member];
//                 const b = newItem[field.member];
//                 if (!field.isEqual(a, b)) {
//                     hasChanges = true;
//                     ret[field.member] = { a, b };
//                 }
//             }
//             return hasChanges ? ret : false;
//         },
//         GetQuickFilterWhereClauseExpression: (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
//             const ret = [] as any[];
//             for (let i = 0; i < table.fields.length; ++i) {
//                 const field = table.fields[i]!;
//                 const clause = field.getQuickFilterWhereClause(query);
//                 if (clause) {
//                     ret.push(clause);
//                 }
//             }
//             return ret;
//             // return [
//             //     { name: { contains: query } },
//             //     { email: { contains: query } },
//             // ];
//         },

//         NewItemDialogSpec: GenerateNewItemDialogSpec(table),

//         Columns: table.fields.map(field => CreateEditGridColumnSpecFromFieldSpec(field)),
//         // [
//         //     CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.PK, MemberName: "id", Editable: true, }),
//         //     CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "name", Editable: true, }),
//         //     CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "email", Editable: true, }),
//         //     CreateEditGridColumnSpec({
//         //         Behavior: CMEditGridColumnType.ForeignObject,
//         //         MemberName: "role",
//         //         FKIDMemberName: "roleId",
//         //         FKEditCellSpec: RoleGridEditCellSpec,
//         //         FKRenderViewCell: RenderRole,
//         //         Editable: true,
//         //     }),
//         // ],
//     };
// }



// model Song {
//     id             Int    @id @default(autoincrement())
//     name           String
//     slug           String
//     startKey       String
//     endKey         String
//     startBPM       Int
//     endBPM         Int
//     introducedYear Int? // purposely fuzzy
//     isDeleted Boolean @default(false)
//     lengthSeconds Int? // length. this is approximate, and could vary wildly esp. considering variations.

//     tags        SongTagAssociation[]
//   }

// interface LocalTextFieldParams {
//     MemberName: string,
//     Label: string,
// };

// const CreateNewItemDialogLocalTextField = (args: LocalTextFieldParams): CMNewItemDialogFieldSpec<string> => {
//     return {
//         MemberName: args.MemberName,
//         IsForeignObject: false,
//         FKIDMemberName: undefined,
//         GetIDOfFieldValue: undefined,
//         RenderInputField: ({ key, validationErrors, onChange, value }) => {
//             return (<CMTextField
//                 key={key}
//                 autoFocus={true}
//                 label={args.Label}
//                 validationError={validationErrors[args.MemberName]}
//                 value={value}
//                 onChange={(e, val) => {
//                     return onChange(val);
//                 }}
//             />);
//         },
//     };
// };

// export const NewSongDialogSpec: CMNewItemDialogSpec<DBSong> = {
//     InitialObj: {
//         name: "",
//         slug: "",
//         startKey: null,
//         endKey: null,
//         startBPM: null,
//         endBPM: null,
//         introducedYear: null,
//         lengthSeconds: null,
//         // tags
//     },
//     ZodSchema: NewSongSchema,

//     Fields: [
//         CreateNewItemDialogLocalTextField({ Label: "Song Name", MemberName: "name" }),
//         CreateNewItemDialogLocalTextField({ Label: "Slug", MemberName: "slug" }),
//         CreateNewItemDialogLocalTextField({ Label: "Start key", MemberName: "startKey" }),
//         CreateNewItemDialogLocalTextField({ Label: "End key", MemberName: "endKey" }),
//         {
//             MemberName: "role",
//             IsForeignObject: true,
//             FKIDMemberName: "id",
//             GetIDOfFieldValue: (value) => (value?.id || null),
//             RenderInputField: ({ key, validationErrors, onChange, value }) => {
//                 return (<CMAutocompleteField<DBRole>
//                     key={key}
//                     columnSpec={RoleAutocompleteSpec}
//                     valueObj={value}
//                     onChange={(role) => onChange}
//                 />);
//             },
//         } as CMNewItemDialogFieldSpec<DBRole>,
//     ],

//     DialogTitle: () => `New song`,
// };
