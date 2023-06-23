import { resolver } from "@blitzjs/rpc";
import db from "db";
import { DeleteChoiceSchema } from "../schemas";

export default resolver.pipe(
  resolver.zod(DeleteChoiceSchema),
  resolver.authorize(),
  async ({ id }) => {
    // TODO: in multi-tenant app, you must add validation to ensure correct tenant
    const choice = await db.choice.deleteMany({ where: { id } });

    return choice;
  }
);
