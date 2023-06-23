import { z } from "zod";

export const CreateChoiceSchema = z.object({
  questionId: z.undefined(),
  text: z.string(),
  vote: z.number(),
  id: z.string(),
  // template: __fieldName__: z.__zodType__(),
});
export const UpdateChoiceSchema = z.object({
  id: z.number(),
  questionId: z.undefined(),
  // template: __fieldName__: z.__zodType__(),
});

export const DeleteChoiceSchema = z.object({
  id: z.number(),
});
