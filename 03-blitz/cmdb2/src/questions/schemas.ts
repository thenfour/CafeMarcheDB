import { z } from "zod";

export const CreateQuestionSchema = z.object({
  text: z.string(),
  choices: z.array(z.object({text: z.string()})),
  // template: __fieldName__: z.__zodType__(),
});
export const UpdateQuestionSchema = z.object({
  id: z.number(),
  //text: z.string(),
  // template: __fieldName__: z.__zodType__(),
});

export const DeleteQuestionSchema = z.object({
  id: z.number(),
});
