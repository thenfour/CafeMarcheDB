import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import {
    UpdatePermission as UpdatePermissionSchema,
} from "../schemas"
import { z } from "zod"
import AU from "shared/associationUtils";
import { Permission } from "shared/permissions";
import utils, { ChangeAction } from "shared/utils"
import { randomUUID } from "crypto";
import { AuthenticatedMiddlewareCtx } from "blitz";

type InputType = z.infer<typeof UpdatePermissionSchema>;

export const IsEqualAssociation = (item1: any, item2: any) => {
    if (!item1 && !item2) return true; // both considered null.
    return (item1?.roleId == item2?.roleId) && (item1?.permissionId == item2?.permissionId);
};

const op = async (prisma: Prisma.TransactionClient | (typeof db), { id, roles, ...fields }: InputType, ctx: AuthenticatedMiddlewareCtx) => {
    try {
        const operationId = randomUUID();
        const changedAt = new Date();

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

        for (let i = 0; i < cp.delete.length; ++i) {
            const oldValues = cp.delete[i];
            await utils.RegisterChange({
                action: ChangeAction.delete,
                context: "updatePermission",
                table: "rolePermission",

                pkid: oldValues.id,
                oldValues,

                operationId,
                changedAt,
                ctx,
            });
        }

        for (let i = 0; i < cp.create.length; ++i) {
            const assoc = cp.create[i]!;
            const newAssoc = await prisma.rolePermission.create({
                data: {
                    roleId: assoc.roleId,
                    permissionId: assoc.permissionId,
                },
            });

            await utils.RegisterChange({
                action: ChangeAction.create,
                context: "updatePermission",
                table: "rolePermission",

                pkid: newAssoc.id,
                newValues: newAssoc,

                operationId,
                changedAt,
                ctx,
            });
        }

        const oldValues = await db.permission.findFirst({ where: { id } });

        const obj = await db.permission.update({
            where: { id },
            data: fields,
            include: { roles: true },
        });

        await utils.RegisterChange({
            action: ChangeAction.update,
            context: "updatePermission",
            table: "permission",
            pkid: obj.id,
            newValues: fields,
            oldValues,
            operationId,
            changedAt,
            ctx,
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
    resolver.authorize("updatePermission", Permission.admin_auth),
    async (data, ctx) => {
        try {
            // todo: put this in a transaction. it fails right now. perhaps a sqlite thing?
            // const obj = await db.$transaction(async (prisma) => {
            //     return await op(prisma, data);
            // });

            // non-transaction
            let obj = await op(db, data, ctx);

            // todo: register in change log.
            return obj;
        } catch (e) {
            console.error(`Exception while updating permission ${data.id}`);
            console.error(e);
            throw (e);
        }
    }
);
