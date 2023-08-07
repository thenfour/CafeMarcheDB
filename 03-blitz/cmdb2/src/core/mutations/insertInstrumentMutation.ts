import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"
import { InsertInstrumentSchema } from "../schemas/instrumentSchemas";
import { randomUUID } from "crypto";

const contextDesc = "insertInstrumentMutation";

// name              String
// sortOrder         Int
// functionalGroupId Int
// instrumentTags    InstrumentTagAssociation[]

export default resolver.pipe(
    resolver.zod(InsertInstrumentSchema),
    resolver.authorize("insertInstrumentMutation", Permission.admin_general),
    async (fields, ctx) => {
        try {
            console.log(fields);
            debugger;
            const changeContext = CreateChangeContext(contextDesc);
            return null;
            // const operationId = randomUUID(); // group multiple changes into 1
            // const changedAt = new Date();

            // const obj = await db.instrument.create({
            //     data: fields,
            // });

            // await RegisterChange({
            //     action: ChangeAction.insert,
            //     changeContext,
            //     table: "instrument",
            //     pkid: obj.id,
            //     newValues: fields,
            //     ctx,
            // });

            // // now register tag associations
            // if (tagIds) {
            //     for (let i = 0; i < tagIds.length; ++i) {
            //         const data = {
            //             instrumentId: obj.id,
            //             tagId: tagIds[i]!,
            //         };
            //         const association = await db.instrumentTagAssociation.create({
            //             data
            //         });

            //         await RegisterChange({
            //             action: ChangeAction.insert,
            //             changeContext,
            //             table: "instrumentTagAssociation",
            //             pkid: association.id,
            //             newValues: data,
            //             ctx,
            //         });
            //     }
            // }

            // now that associations have also been created, return the fully constructed object.
            // const obj2 = await db.instrument.findFirst({
            //     where: { id: obj.id },
            //     include: {
            //         functionalGroup: true,
            //         instrumentTags: {
            //             include: { instrument: true }
            //         },
            //     }
            // });

            //return obj2;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);
