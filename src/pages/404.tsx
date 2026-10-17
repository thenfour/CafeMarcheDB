import { defineCmdbPage } from "src/route/cmdbPage";
import Head from "next/head"
import { ErrorComponent } from "@blitzjs/next"

// ------------------------------------------------------
// This page is rendered if a route match is not found
// ------------------------------------------------------
function Page404() {
  const statusCode = 404
  const title = "This page could not be found"
  const pageTitle = `${statusCode}: ${title}`
  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <ErrorComponent statusCode={statusCode} title={title} />
    </>
  )
}

defineCmdbPage("_404", Page404);
export default Page404;
