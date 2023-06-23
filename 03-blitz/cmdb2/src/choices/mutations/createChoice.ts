import { resolver } from "@blitzjs/rpc";
import db from "db";
import { CreateChoiceSchema } from "../schemas";

export default resolver.pipe(
  resolver.zod(CreateChoiceSchema),
  resolver.authorize(),
  async (input) => {
    // TODO: in multi-tenant app, you must add validation to ensure correct tenant
    const choice = await db.choice.create({ data: input });

    return choice;
  }
);
