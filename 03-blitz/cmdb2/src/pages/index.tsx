import { Suspense } from "react"
import Link from "next/link"
import Layout from "src/core/layouts/Layout"
import { useCurrentUser } from "src/users/hooks/useCurrentUser"
import logout from "src/auth/mutations/logout"
import { useMutation } from "@blitzjs/rpc"
import { Routes, BlitzPage } from "@blitzjs/next"
import styles from "src/styles/Home.module.css"
import { LoginForm } from "src/auth/components/LoginForm"
import { useRouter } from "next/router"
//import DashboardMain from "src/core/components/DashboardMain"
import Dashboard2 from "src/core/components/Dashboard2"
import UserAppBarIcon from "src/core/components/UserAppBarIcon";


const LoginSignup = () => {
  const router = useRouter()
  return (
    <>
      <Link href={Routes.SignupPage()} className={styles.button}>
        <strong>Sign Up</strong>
      </Link>
      <Link href="/api/auth/google" className={styles.loginButton}>
        <strong>Google</strong>
      </Link>
      <LoginForm
        onSuccess={(_user) => {
          const next = router.query.next ? decodeURIComponent(router.query.next as string) : "/"
          return router.push(next)
        }}
      />

    </>
  );
};

const Home2 = () => {

  const currentUser = useCurrentUser()

  if (currentUser) {
    return (
      <Dashboard2></Dashboard2>
      //<UserAppBarIcon></UserAppBarIcon>
    );
  }

  // no user:
  return (
    // <Layout title="Home">
    <LoginSignup></LoginSignup>
  )
}

const Home: BlitzPage = () => {

  return (
    <Suspense fallback="Loading...">
      <Home2></Home2>
    </Suspense>
  )
}

export default Home
