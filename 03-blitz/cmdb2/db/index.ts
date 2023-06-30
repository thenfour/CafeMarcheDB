import { enhancePrisma } from "blitz"
import { PrismaClient } from "@prisma/client"

const EnhancedPrisma = enhancePrisma(PrismaClient)

export * from "@prisma/client"
const db = new EnhancedPrisma()

// we could use hooks here to implement the change logging,
// but i prefer to just create some util functions and do it explicitly at the mutation site.
// that's more flexible and less "magic-y"
// db.$use(async (params, next) => {
//     const { model, action, args } = params;

//     // // Capture "create" action
//     // if (model === 'User' && action === 'create') {
//     //   const user = await prisma.user.create(args);
//     //   await prisma.dbChange.create({
//     //     data: {
//     //       tableName: model,
//     //       recordId: user.id,
//     //       action: 'create',
//     //     },
//     //   });
//     //   return user;
//     // }

//     // // Capture "update" action
//     // if (model === 'User' && action === 'update') {
//     //   const updatedUser = await prisma.user.update(args);
//     //   await prisma.dbChange.create({
//     //     data: {
//     //       tableName: model,
//     //       recordId: updatedUser.id,
//     //       action: 'update',
//     //     },
//     //   });
//     //   return updatedUser;
//     // }

//     // // Capture "delete" action
//     // if (model === 'User' && action === 'delete') {
//     //   const deletedUser = await prisma.user.delete(args);
//     //   await prisma.dbChange.create({
//     //     data: {
//     //       tableName: model,
//     //       recordId: deletedUser.id,
//     //       action: 'delete',
//     //     },
//     //   });
//     //   return deletedUser;
//     // }

//     return next(params);
//   });






export default db
