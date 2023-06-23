import { Suspense } from "react";
import { Routes } from "@blitzjs/next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery, useMutation } from "@blitzjs/rpc";
import { useParam } from "@blitzjs/next";

import Layout from "src/core/layouts/Layout";
import { UpdateQuestionSchema } from "src/questions/schemas";
import getQuestion from "src/questions/queries/getQuestion";
import updateQuestion from "src/questions/mutations/updateQuestion";
import {
  QuestionForm,
  FORM_ERROR,
} from "src/questions/components/QuestionForm";

export const EditQuestion = () => {
  const router = useRouter();
  const questionId = useParam("questionId", "number");
  const [question, { setQueryData }] = useQuery(
    getQuestion,
    { id: questionId },
    {
      // This ensures the query never refreshes and overwrites the form data while the user is editing.
      staleTime: Infinity,
    }
  );
  const [updateQuestionMutation] = useMutation(updateQuestion);

  return (
    <>
      <Head>
        <title>Edit Question {question.id}</title>
      </Head>

      <div>
        <h1>Edit Question {question.id}</h1>
        <pre>{JSON.stringify(question, null, 2)}</pre>
        <Suspense fallback={<div>Loading...</div>}>
          <QuestionForm
            submitText="Update Question"
            schema={UpdateQuestionSchema}
            initialValues={question}
            onSubmit={async (values) => {
              try {
                const updated = await updateQuestionMutation({
                  id: question.id,
                  ...values,
                });
                await setQueryData(updated);
                await router.push(
                  Routes.ShowQuestionPage({ questionId: updated.id })
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
      </div>
    </>
  );
};

const EditQuestionPage = () => {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <EditQuestion />
      </Suspense>

      <p>
        <Link href={Routes.QuestionsPage()}>Questions</Link>
      </p>
    </div>
  );
};

EditQuestionPage.authenticate = true;
EditQuestionPage.getLayout = (page) => <Layout>{page}</Layout>;

export default EditQuestionPage;
