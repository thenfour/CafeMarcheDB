import { resolver } from "@blitzjs/rpc"
import db from "db"
import {
    CreateRole as CreateRoleSchema,
    UpdateRole as UpdateRoleSchema,
    DeleteRole as DeleteRoleSchema,
} from "../schemas"
//import { PublicData } from "@blitzjs/auth";
import { CreatePublicData } from "types";

// ROLES & PERMISSIONS
export const CreateRoleMutation = resolver.pipe(
    resolver.zod(CreateRoleSchema),
    async (fields, ctx) => {
        try {
            // TODO: do permissions check
            // if (!ctx.session.roles.includes("admin")) {
            //     throw new Error("You don't have permission to create a role.");
            //   }

            const obj = await db.role.create({
                data: fields,
            });

            // todo: register in change log.

            return obj;
        } catch (e) {
            console.error(`Exception while creating role`);
            console.error(e);
            throw (e);
        }
    }
);

export const UpdateRoleMutation = resolver.pipe(
    resolver.zod(UpdateRoleSchema),
    resolver.authorize(),
    async ({ id, ...data }) => {
        try {
            // TODO: do permissions check
            const obj = await db.role.update({
                where: { id },
                data: {
                    name: data.name,//
                    description: data.description,//
                }
            });
            // todo: register in change log.
            return obj;
        } catch (e) {
            console.error(`Exception while creating role`);
            console.error(e);
            throw (e);
        }
    }
);

export const DeleteRoleMutation = resolver.pipe(
    resolver.zod(DeleteRoleSchema),
    resolver.authorize(),
    async ({ id }) => {
        // TODO: do permissions check
        const choice = await db.role.deleteMany({ where: { id } });
        // todo: register in change log.
        return choice;
    }
);
