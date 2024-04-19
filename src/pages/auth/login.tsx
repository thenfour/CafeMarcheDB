// this page is not used. login functions are done when visiting any page and you're not logged in.

import { BlitzPage } from "@blitzjs/next"
import Layout from "src/core/layouts/Layout"
import { LoginForm } from "src/auth/components/LoginForm"
import { useRouter } from "next/router"

// const LoginPage: BlitzPage = () => {
//   const router = useRouter()

//   return (
//     <Layout title="Log In">
//       <LoginForm
//         onSuccess={(_user) => {
//           const next = router.query.next ? decodeURIComponent(router.query.next as string) : "/"
//           return router.push(next)
//         }}
//       />
//     </Layout>
//   )
// }

const LoginPage = () => {
  return <>not implemented</>;
}

export default LoginPage
