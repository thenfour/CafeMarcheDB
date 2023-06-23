import { Routes } from "@blitzjs/next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMutation } from "@blitzjs/rpc";
import Layout from "src/core/layouts/Layout";
import { CreateQuestionSchema } from "src/questions/schemas";
import createQuestion from "src/questions/mutations/createQuestion";
import {
  QuestionForm,
  FORM_ERROR,
} from "src/questions/components/QuestionForm";
import { Suspense } from "react";

const NewQuestionPage = () => {
  const router = useRouter();
  const [createQuestionMutation] = useMutation(createQuestion);

  return (
    <Layout title={"Create New Question"}>
      <h1>Create New Question</h1>
      <Suspense fallback={<div>Loading...</div>}>

        <QuestionForm
          submitText="Create Question"
          schema={CreateQuestionSchema}
          initialValues={{text: "text here", choices: []}}
          onSubmit={async (values) => {
            try {
              const question = await createQuestionMutation(values);
              await router.push(
                Routes.ShowQuestionPage({ questionId: question.id })
              );
            } catch (error: any) {
              console.error(error);
              return {
                [FORM_ERROR]: error.toString(),
              };
            }
          }}
        />
      </Suspense>
      <p>
        <Link href={Routes.QuestionsPage()}>Questions</Link>
      </p>
    </Layout>
  );
};

NewQuestionPage.authenticate = true;

export default NewQuestionPage;
