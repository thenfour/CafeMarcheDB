import { resolver } from "@blitzjs/rpc"
import db, { Prisma, Role, RolePermission, Permission as DBPermission } from "db";
import {
    ToggleRolePermission as ToggleRolePermissionSchema,
} from "../schemas"
import { z } from "zod"
import AU from "shared/associationUtils";
import { Permission } from "shared/permissions";
import utils, { ChangeAction } from "shared/utils"
import { randomUUID } from "crypto";
import { AuthenticatedMiddlewareCtx } from "blitz";

type InputArgs = z.infer<typeof ToggleRolePermissionSchema>;

export default resolver.pipe(
    resolver.zod(ToggleRolePermissionSchema),
    resolver.authorize("toggleRolePermission", Permission.admin_auth),
    async (data: InputArgs, ctx) => {
        try {
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

                await utils.RegisterChange({
                    action: ChangeAction.insert,
                    context: "toggleRolePermission",
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

                await utils.RegisterChange({
                    action: ChangeAction.delete,
                    context: "toggleRolePermission",
                    table: "rolePermission",
                    pkid: existingObj.id,
                    oldValues: existingObj,
                    ctx,
                });
            }


            return null;

            //console.assert();
            //}
            //debugger;
            ///return data.association;
        } catch (e) {
            console.error(`Exception while toggleRolePermission`);
            console.error(e);
            throw (e);
        }
    }
);
