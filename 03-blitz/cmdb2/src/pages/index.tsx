import { BlitzPage, Routes } from "@blitzjs/next";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
//import { Backdrop, CircularProgress } from "@material-ui/core";
import { AppBar } from "@mui/material";
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from "next/link";
import { useRouter } from "next/router";
import { Suspense } from "react";
import { LoginForm } from "src/auth/components/LoginForm";
import Dashboard2 from "src/core/components/Dashboard2";
import Test from 'src/core/components/test';
import { useCurrentUser } from "src/users/hooks/useCurrentUser";
import { css } from '@emotion/react'
import DashboardLayout from "src/core/layouts/DashboardLayout";

// const Home2 = () => {

//   const currentUser = useCurrentUser();

//   if (currentUser) {
//     return (
//       <Dashboard2>
//         <Typography component="h2" variant="h6" gutterBottom>
//           On small and extra-small screens the sidebar/drawer is temporary and
//           can be opened via the menu icon in the toolbar.
//         </Typography>
//         <div
//           css={{
//             backgroundColor: 'hotpink',
//             '&:hover': {
//               color: 'lightgreen'
//             }
//           }}
//         >
//           This has a hotpink background.
//         </div>
//       </Dashboard2>
//     );
//   }

//   // no user:
//   return (
//     // <Layout title="Home">
//     <LoginSignup></LoginSignup>
//   )
// }

const Home: BlitzPage = () => {
  return (
    <DashboardLayout title="Home">
      home page.
    </DashboardLayout>
  )
}


export default Home;
