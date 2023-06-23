import { Suspense } from "react";
import { Routes } from "@blitzjs/next";
import Head from "next/head";
import Link from "next/link";
import { usePaginatedQuery } from "@blitzjs/rpc";
import { useRouter } from "next/router";
import Layout from "src/core/layouts/Layout";
import getQuestions from "src/questions/queries/getQuestions";

const ITEMS_PER_PAGE = 100;

export const QuestionsList = () => {
  const router = useRouter();
  const page = Number(router.query.page) || 0;
  const [{ questions, hasMore }] = usePaginatedQuery(getQuestions, {
    orderBy: { id: "asc" },
    skip: ITEMS_PER_PAGE * page,
    take: ITEMS_PER_PAGE,
  });

  const goToPreviousPage = () => router.push({ query: { page: page - 1 } });
  const goToNextPage = () => router.push({ query: { page: page + 1 } });

  return (
    <div>
      <ul>
        {questions.map((question) => (
          <li key={question.id}>
            <Link href={Routes.ShowQuestionPage({ questionId: question.id })}>
              {question.text}
            </Link>
            <ul>
       {question.choices.map((choice) => (
         <li key={choice.id}>
           {choice.text} - {choice.votes} votes
         </li>
       ))}
     </ul>
          </li>
        ))}
      </ul>

      <button disabled={page === 0} onClick={goToPreviousPage}>
        Previous
      </button>
      <button disabled={!hasMore} onClick={goToNextPage}>
        Next
      </button>
    </div>
  );
};

const QuestionsPage = () => {
  return (
    <Layout>
      <Head>
        <title>Questions</title>
      </Head>

      <div>
        <p>
          <Link href={Routes.NewQuestionPage()}>Create Question</Link>
        </p>

        <Suspense fallback={<div>Loading...</div>}>
          <QuestionsList />
        </Suspense>
      </div>
    </Layout>
  );
};

export default QuestionsPage;
