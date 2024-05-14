import { useRouter } from "next/router"
import Layout from "src/core/layouts/Layout"
import { SignupForm } from "src/auth/components/SignupForm"
import { BlitzPage, Routes } from "@blitzjs/next"
import DashboardLayout from "src/core/layouts/DashboardLayout"
import { simulateLinkClick } from "src/core/components/CMCoreComponents2"

const MainContent: BlitzPage = () => {
  const router = useRouter()

  return <SignupForm onSuccess={() => simulateLinkClick(Routes.Home())} />
}




const SignupPage: BlitzPage = () => {
  return (
    <DashboardLayout title="Signup" disableLoginRedirect>
      <MainContent />
    </DashboardLayout>
  )
}


export default SignupPage
