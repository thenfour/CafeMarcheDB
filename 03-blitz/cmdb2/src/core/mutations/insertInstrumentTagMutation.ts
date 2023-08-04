import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import utils, { ChangeAction, CreateChangeContext } from "shared/utils"
import { InsertInstrumentTagSchema } from "../schemas/instrumentSchemas";

const contextDesc = "insertInstrumentTagMutation";

export default resolver.pipe(
    resolver.zod(InsertInstrumentTagSchema),
    resolver.authorize(contextDesc, Permission.admin_general),
    async ({ ...fields }, ctx) => {
        try {
            const changeContext = CreateChangeContext(contextDesc);

            const obj = await db.instrumentTag.create({
                data: fields,
            });

            await utils.RegisterChange({
                action: ChangeAction.insert,
                changeContext,
                table: "instrumentTag",
                pkid: obj.id,
                newValues: fields,
                ctx,
            });

            return obj;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);
