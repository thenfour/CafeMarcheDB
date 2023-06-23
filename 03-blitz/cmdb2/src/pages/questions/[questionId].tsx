import { Suspense } from "react";
import { Routes } from "@blitzjs/next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery, useMutation } from "@blitzjs/rpc";
import { useParam } from "@blitzjs/next";

import Layout from "src/core/layouts/Layout";
import getQuestion from "src/questions/queries/getQuestion";
import deleteQuestion from "src/questions/mutations/deleteQuestion";
import voteQuestion from "src/choices/mutations/updateChoice";

export const Question = () => {
  const router = useRouter();
  const questionId = useParam("questionId", "number");
  const [deleteQuestionMutation] = useMutation(deleteQuestion);
  const [voteQuestionMutation] = useMutation(voteQuestion);

  const [question, {refetch}] = useQuery(getQuestion, { id: questionId });

  const handleVote = async (id: number) => {
    try {
      await voteQuestionMutation({id})
      refetch()
    } catch (error) {
      alert("Error updating choice " + JSON.stringify(error, null, 2))
    }
  }  

  return (
    <>
      <Head>
        <title>Question {question.id} - {question.text}</title>
      </Head>

      <div>
        <h1>Question  {question.id} - {question.text}</h1>
        <pre>{JSON.stringify(question, null, 2)}</pre>

        <ul>
  {question.choices.map((choice) => (

<li key={choice.id}>
  {choice.text} - {choice.votes} votes
  <button onClick={() => handleVote(choice.id)}>Vote</button>
</li>
  ))}
</ul>


        <Link href={Routes.EditQuestionPage({ questionId: question.id })}>
          Edit
        </Link>

        <button
          type="button"
          onClick={async () => {
            if (window.confirm("This will be deleted")) {
              await deleteQuestionMutation({ id: question.id });
              await router.push(Routes.QuestionsPage());
            }
          }}
          style={{ marginLeft: "0.5rem" }}
        >
          Delete
        </button>
      </div>
    </>
  );
};

const ShowQuestionPage = () => {
  return (
    <div>
      <p>
        <Link href={Routes.QuestionsPage()}>Questions</Link>
      </p>

      <Suspense fallback={<div>Loading...</div>}>
        <Question />
      </Suspense>
    </div>
  );
};

ShowQuestionPage.authenticate = true;
ShowQuestionPage.getLayout = (page) => <Layout>{page}</Layout>;

export default ShowQuestionPage;
