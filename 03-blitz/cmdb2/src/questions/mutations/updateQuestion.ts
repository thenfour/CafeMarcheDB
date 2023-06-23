import { resolver } from "@blitzjs/rpc";
import db from "db";
import { UpdateQuestionSchema } from "../schemas";

export default resolver.pipe(
  resolver.zod(UpdateQuestionSchema),
  resolver.authorize(),
  async ({ id, ...data }) => {
    // TODO: in multi-tenant app, you must add validation to ensure correct tenant
    const question = await db.question.update({
      where: { id },
      data,
    });

    return question;
  }
);
