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

const LoginSignup = () => {
  const router = useRouter()
  return (
    <>
      <Link href={Routes.SignupPage()}>
        <strong>Sign Up</strong>
      </Link>
      <Link href="/api/auth/google">
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

  const currentUser = useCurrentUser();

  if (currentUser) {
    return (
      <Dashboard2>
        <Typography component="h2" variant="h6" gutterBottom>
          On small and extra-small screens the sidebar/drawer is temporary and
          can be opened via the menu icon in the toolbar.
        </Typography>
      </Dashboard2>
    );
  }

  // no user:
  return (
    // <Layout title="Home">
    <LoginSignup></LoginSignup>
  )
}

const Home: BlitzPage = () => {


  const fallback =
    <Backdrop open={true} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <CircularProgress color="inherit" />
    </Backdrop>
    ;

  return (
    <Suspense fallback={fallback}>
      <Home2></Home2>
    </Suspense>
  )
}



// const Home3: BlitzPage = () => {

//   return <Box>
//     <AppBar position="relative" color="primary">
//       ntaoheu
//     </AppBar>
//     <Test>
//     </Test>
//   </Box>
//     ;

//   //return <Box><Test></Test></Box>;
// }





export default Home;
