import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, ChangeContext } from "shared/utils";

// returns changes required to update old associations to the new.
interface ChangePlan<T> {
    create: T[],
    delete: T[],
    desiredState: T[],
};
function InAButNotB<T>(a: T[], b: T[], isEqualFn: (a: T, b: T) => boolean): T[] {
    return a.filter((item) => !b.some((element) => isEqualFn(item, element)));
};

export function ComputeChangePlan<T>(a: T[], b: T[], isEqualFn: (a: T, b: T) => boolean): ChangePlan<T> {
    const ret = {
        create: InAButNotB(b, a, isEqualFn),// creates are items in B but not in A.
        delete: InAButNotB(a, b, isEqualFn),// creates are items in B but not in A.
        desiredState: [...b], // make array copy
    };
    return ret;
};



// // what makes something tag-style is that the association object is just 2 ids to associate them.
// // also the sides of the association are not equal so this can be seen from one side only, as " local object"  and Tag.
// export interface UpdateTagStyleAssociationsArgs {
//     prisma: Prisma.TransactionClient | (typeof db),
//     ctx: AuthenticatedMiddlewareCtx,
//     changeContext: ChangeContext,

//     localId: number,
//     tagIds: number[],
//     associationTableName: string, // instrumentTagAssociation
//     associationLocalIdFieldName: string, // instrumentId
//     associationTagIdFieldName: string, // tagId
// };

// export const UpdateTagStyleAssociations = async ({ prisma, changeContext, ctx, ...args }: UpdateTagStyleAssociationsArgs) => {

//     const currentAssociations = await prisma[args.associationTableName].findMany({
//         where: { [args.associationLocalIdFieldName]: args.localId },
//     });

//     const cp = ComputeChangePlan(currentAssociations.map(a => a.tagId), args.tagIds, (a, b) => a === b);

//     // remove associations which exist but aren't in the new array
//     await prisma[args.associationTableName].deleteMany({
//         where: {
//             [args.associationLocalIdFieldName]: args.localId,
//             [args.associationTagIdFieldName]: {
//                 in: cp.delete,
//             },
//         },
//     });

//     // register those deletions
//     for (let i = 0; i < cp.delete.length; ++i) {
//         const oldValues = currentAssociations.find(a => a[args.associationTagIdFieldName] === cp.delete[i])!;
//         await utils.RegisterChange({
//             action: ChangeAction.delete,
//             changeContext,
//             table: args.associationTableName,
//             pkid: oldValues.id,
//             oldValues,
//             ctx,
//         });
//     }

//     // create new associations
//     for (let i = 0; i < cp.create.length; ++i) {
//         const tagId = cp.create[i]!;
//         const newAssoc = await prisma[args.associationTableName].create({
//             data: {
//                 [args.associationLocalIdFieldName]: args.localId,
//                 [args.associationTagIdFieldName]: tagId,
//             },
//         });

//         await utils.RegisterChange({
//             action: ChangeAction.insert,
//             changeContext,
//             table: args.associationTableName,
//             pkid: newAssoc.id,
//             newValues: newAssoc,
//             ctx,
//         });
//     }

// };


// export interface DeleteByIdMutationImplementationArgs {
//     id: number,
//     tableName: string,
//     ctx: AuthenticatedMiddlewareCtx,
//     changeContext: ChangeContext,
// };

// export const DeleteByIdMutationImplementation = async ({ id, ctx, ...args }: DeleteByIdMutationImplementationArgs) => {
//     try {
//         const oldValues = await db[args.tableName].findFirst({ where: { id } });
//         const choice = await db[args.tableName].deleteMany({ where: { id } });

//         await utils.RegisterChange({
//             action: ChangeAction.delete,
//             changeContext: args.changeContext,
//             table: args.tableName,
//             pkid: id,
//             oldValues,
//             ctx,
//         });

//         return choice;
//     } catch (e) {
//         console.error(`Error deleting id:${id}, table:${args.tableName}, context:${JSON.stringify(args.changeContext)}`);
//         console.error(e);
//         throw (e);
//     }
// }










// export default {
//     ComputeChangePlan,
//     UpdateTagStyleAssociations,
// };