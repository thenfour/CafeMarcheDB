import { resolver } from "@blitzjs/rpc";
import db from "db";
import { UpdateChoiceSchema } from "../schemas";

export default resolver.pipe(
  resolver.zod(UpdateChoiceSchema),
  resolver.authorize(),
  async ({ id, ...data }) => {
    // TODO: in multi-tenant app, you must add validation to ensure correct tenant
    const choice = await db.choice.update({ where: { id }, data: {votes: {increment: 1}} });

    return choice;
  }
);
