import { BlitzPage, Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
//import { AppBar, Paper, Toolbar } from '@mui/core';
//import CssBaseline from "@material-ui/core/CssBaseline";
import { AppBar } from "@mui/material";
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Link from "next/link";
import { useRouter } from "next/router";
import * as React from 'react';
import { Suspense } from "react";
import ReactDOM from 'react-dom/client';
import { LoginForm } from "src/auth/components/LoginForm";
import logout from "src/auth/mutations/logout";
import Dashboard2 from "src/core/components/Dashboard2";
import Dashboard3 from "src/core/components/Dashboard3";
import UserAppBarIcon from "src/core/components/UserAppBarIcon";
import Test from 'src/core/components/test';
import Layout from "src/core/layouts/Layout";
import { useCurrentUser } from "src/users/hooks/useCurrentUser";

// import { createTheme, ThemeProvider } from '@mui/material/styles';
// import { themeOptions } from "src/core/theme"

//const theme = createTheme(themeOptions);

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

  // return (
  //   <div>
  //     <Button variant="text">Text</Button>
  //     <Button variant="contained">Contained</Button>
  //     <Button variant="outlined">Outlined</Button>
  //   </div>
  // );

  // return <></>;

  return (
    <Suspense fallback="Loading...">
      <Home2></Home2>
    </Suspense>
  )
}



const Home3: BlitzPage = () => {

  return <Box>
    <AppBar position="relative" color="primary">
      ntaoheu
    </AppBar>
    <Test>
    </Test>
  </Box>
    ;

  //return <Box><Test></Test></Box>;
}





export default Home;
