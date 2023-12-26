import { resolver } from "@blitzjs/rpc"
import db, { Prisma, Role, RolePermission, Permission as DBPermission } from "db";
import {
    ToggleRolePermission as ToggleRolePermissionSchema,
} from "../schemas"
import { z } from "zod"
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"
import { randomUUID } from "crypto";
import { AuthenticatedMiddlewareCtx } from "blitz";

type InputArgs = z.infer<typeof ToggleRolePermissionSchema>;

export default resolver.pipe(
    resolver.zod(ToggleRolePermissionSchema),
    resolver.authorize(Permission.sysadmin),
    async (data: InputArgs, ctx) => {
        try {
            const changeContext = CreateChangeContext("toggleRolePermissionMutation");
            // non-transaction
            //let obj = await op(db, data, ctx);
            if (!data.association) {
                // create an association.
                const newAssoc = await db.rolePermission.create({
                    data: {
                        roleId: data.xId,
                        permissionId: data.yId,
                    },
                    include: { role: true, permission: true },
                });

                await RegisterChange({
                    action: ChangeAction.insert,
                    changeContext,
                    table: "rolePermission",
                    pkid: newAssoc.id,
                    newValues: newAssoc,
                    ctx,
                });

                return newAssoc;

            }

            // delete existing association.

            const existingObj = await db.rolePermission.findFirst({
                where: {
                    roleId: data.association!.roleId,
                    permissionId: data.association!.permissionId,
                },
            });

            if (existingObj) {

                await db.rolePermission.deleteMany({
                    where: {
                        id: existingObj.id,
                    }
                });

                await RegisterChange({
                    action: ChangeAction.delete,
                    changeContext,
                    table: "rolePermission",
                    pkid: existingObj.id,
                    oldValues: existingObj,
                    ctx,
                });
            }

            return null;

        } catch (e) {
            console.error(`Exception while toggleRolePermission`);
            console.error(e);
            throw (e);
        }
    }
);
