import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import {
    UpdatePermission as UpdatePermissionSchema,
} from "../schemas"
import { z } from "zod"
import AU from "shared/associationUtils";

type InputType = z.infer<typeof UpdatePermissionSchema>;

export const IsEqualAssociation = (item1: any, item2: any) => {
    if (!item1 && !item2) return true; // both considered null.
    return (item1?.roleId == item2?.roleId) && (item1?.permissionId == item2?.permissionId);
};

const op = async (prisma: Prisma.TransactionClient | (typeof db), { id, name, description, roles }: InputType) => {
    try {

        const currentAssociations = await prisma.rolePermission.findMany({
            where: {
                permissionId: id
            },
        });

        const cp = AU.ComputeChangePlan(currentAssociations, roles, IsEqualAssociation);

        await prisma.rolePermission.deleteMany({
            where: {
                permissionId: id,
                roleId: {
                    in: cp.delete.map((assoc) => assoc.roleId),
                },
            },
        });

        for (let i = 0; i < cp.create.length; ++i) {
            const assoc = cp.create[i]!;
            await prisma.rolePermission.create({
                data: {
                    roleId: assoc.roleId,
                    permissionId: assoc.permissionId,
                },
            });
        }

        const obj = await db.permission.update({
            where: { id },
            data: {
                name,//
                description,//
            },
            include: { roles: true },
        });

        return obj;
    } catch (e) {
        console.error(`Exception during db transaction updating permissions`);
        console.error(e);
        throw (e);
    }
};

export default resolver.pipe(
    resolver.zod(UpdatePermissionSchema),
    resolver.authorize(),
    async (data, ctx) => {
        try {

            // TODO: do permissions check

            // todo: put this in a transaction. it fails right now. perhaps a sqlite thing?
            // const obj = await db.$transaction(async (prisma) => {
            //     return await op(prisma, data);
            // });

            // non-transaction
            let obj = await op(db, data);

            // todo: register in change log.
            return obj;
        } catch (e) {
            console.error(`Exception while updating permission ${data.id}`);
            console.error(e);
            throw (e);
        }
    }
);
