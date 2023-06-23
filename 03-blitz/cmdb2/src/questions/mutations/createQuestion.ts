import { resolver } from "@blitzjs/rpc";
import db from "db";
import { CreateQuestionSchema } from "../schemas";

export default resolver.pipe(
  resolver.zod(CreateQuestionSchema),
  resolver.authorize(),
  async (input) => {
    // TODO: in multi-tenant app, you must add validation to ensure correct tenant
    //const question = await db.question.create({ data: input });

    const question = await db.question.create({
      data: {
        ...input,
        choices: {create: input.choices},
      },
    })

    return question;
  }
);
