import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Prisma } from "db";

import { Permission } from "shared/permissions";
import { InsertInstrumentTagFromStringAsAssociationSchema } from "../schemas/instrumentSchemas";
import { ChangeAction, CreateChangeContext, Nullable, RegisterChange } from "shared/utils";

const contextDesc = "insertInstrumentTagFromStringAsAssociationMutation";



type TInput = Prisma.InstrumentTagCreateInput & { localPk: number | null };

export default resolver.pipe(
    resolver.zod(InsertInstrumentTagFromStringAsAssociationSchema),
    resolver.authorize(contextDesc, Permission.admin_general),
    async ({ localPk, ...data }: TInput, ctx) => {
        //const x = args.localPk;
        //args..
        //const {localPk, ...data} = args;
        try {
            const changeContext = CreateChangeContext(contextDesc);

            const obj = await db.instrumentTag.create({
                data
            });

            await RegisterChange({
                action: ChangeAction.insert,
                changeContext,
                table: "instrumentTag",
                pkid: obj.id,
                newValues: data,
                ctx,
            });

            // return as a mockup association
            const ret: Nullable<Prisma.InstrumentTagAssociationGetPayload<{ include: { tag: true } }>> = {
                id: null,
                instrumentId: localPk,
                tagId: obj.id,
                tag: obj,
            };

            return ret;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);
