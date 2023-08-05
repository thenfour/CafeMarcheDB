import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { z } from "zod"
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"
import { randomUUID } from "crypto";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { UpdateInstrumentSchema } from "../schemas/instrumentSchemas";
import { UpdateTagStyleAssociations } from "shared/associationUtils";

type InputType = z.infer<typeof UpdateInstrumentSchema>;
const contextDesc = "updateInstrumentMutation";

const op = async (prisma: Prisma.TransactionClient | (typeof db), { id, tagIds, ...fields }: InputType, ctx: AuthenticatedMiddlewareCtx) => {
    try {
        const changeContext = CreateChangeContext(contextDesc);

        // 1. update associations (delete or create as needed)
        if (tagIds) {
            UpdateTagStyleAssociations({
                prisma,
                ctx,
                changeContext,
                localId: id,
                tagIds,
                associationTableName: "instrumentTagAssociation", // 
                associationLocalIdFieldName: "instrumentId",
                associationTagIdFieldName: "tagId",
            });
        } // if tagids

        const oldValues = await db.instrument.findFirst({ where: { id } });

        const obj = await db.instrument.update({
            where: { id },
            data: fields,
            include: {
                instrumentTags: { include: { tag: true } },
                functionalGroup: true,
            },
        });

        await RegisterChange({
            action: ChangeAction.update,
            changeContext,
            table: "instrument",
            pkid: obj.id,
            newValues: fields,
            oldValues,
            ctx,
        });

        return obj;
    } catch (e) {
        console.error(`Exception during db transaction updating instrument`);
        console.error(e);
        throw (e);
    }
};

export default resolver.pipe(
    resolver.zod(UpdateInstrumentSchema),
    resolver.authorize("UpdateInstrument", Permission.admin_general),
    async (data, ctx) => {
        try {
            // todo: put in transaction
            let obj = await op(db, data, ctx);
            return obj;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);
