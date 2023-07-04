import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const Home: BlitzPage = () => {
  return (
    <DashboardLayout title="Home">
      home page.
    </DashboardLayout>
  )
}


export default Home;
