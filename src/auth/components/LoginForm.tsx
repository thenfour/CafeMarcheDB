import { AuthenticationError, PromiseReturnType } from "blitz"
import Link from "next/link"
//import { LabeledTextField } from "src/core/components/LabeledTextField"
//import { Form, FORM_ERROR } from "src/core/components/Form"
import login from "src/auth/mutations/login"
//import { Login } from "src/auth/schemas"
import { useMutation } from "@blitzjs/rpc"
import { FormControlLabel } from "@mui/material"
//import { Routes } from "@blitzjs/next"
import React, { Suspense } from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { Routes } from "@blitzjs/next";
import { NameValuePair } from "src/core/components/CMCoreComponents2"

type LoginFormProps = {
  onSuccess?: (user: PromiseReturnType<typeof login>) => void
}

export const LoginForm = (props: LoginFormProps) => {
  const [loginMutation] = useMutation(login);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const user = await loginMutation({
        email,
        password,
      });
      props.onSuccess?.(user)
    } catch (error: any) {
      console.log(error);
      if (error instanceof AuthenticationError) {
        showSnackbar({ severity: "error", children: "Sorry, those credentials are invalid" });
      } else {
        showSnackbar({ severity: "error", children: "Sorry, we had an unexpected error. Please try again. - " + error.toString() });
      }
    }
  };

  return (<div>
    <div className="link createNewAccount">
      Login using email & password
    </div>
    <form onSubmit={handleSubmit} method="">
      <NameValuePair
        isReadOnly={false}
        name={"Email"}
        value={<input type="text" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />}
      />
      <NameValuePair
        isReadOnly={false}
        name={"Password"}
        value={<input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />}
      />
      <div><input type="submit" value="Login" /></div>
      <Link href={"/auth/forgot-password"}>Forgot your password?</Link>
    </form>

    {/*
      
      TODO: forgot password function

      <div>
        <Link href={Routes.ForgotPasswordPage()}>Forgot your password?</Link>
      </div> */}

    {/* <div style={{ marginTop: "1rem" }}>
        Or <Link href={Routes.SignupPage()}>Sign Up</Link>
      </div> */}
  </div>);
}

export default LoginForm
