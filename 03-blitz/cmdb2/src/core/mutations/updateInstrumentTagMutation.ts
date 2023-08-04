import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { z } from "zod"
import { Permission } from "shared/permissions";
import utils, { ChangeAction, CreateChangeContext } from "shared/utils"
import { randomUUID } from "crypto";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { UpdateInstrumentTagSchema } from "../schemas/instrumentSchemas";

type InputType = z.infer<typeof UpdateInstrumentTagSchema>;
const contextDesc = "updateInstrumentTagMutation";

const op = async (prisma: Prisma.TransactionClient | (typeof db), { id, ...fields }: InputType, ctx: AuthenticatedMiddlewareCtx) => {
    try {
        const oldValues = await db.instrumentTag.findFirst({ where: { id } });

        const obj = await db.instrumentTag.update({
            where: { id },
            data: fields,
            include: {
                instruments: true,
            },
        });

        await utils.RegisterChange({
            action: ChangeAction.update,
            table: "instrumentTag",
            pkid: obj.id,
            newValues: fields,
            oldValues,
            changeContext: CreateChangeContext(contextDesc),
            ctx,
        });

        return obj;
    } catch (e) {
        console.error(e);
        throw (e);
    }
};

export default resolver.pipe(
    resolver.zod(UpdateInstrumentTagSchema),
    resolver.authorize(contextDesc, Permission.admin_general),
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
