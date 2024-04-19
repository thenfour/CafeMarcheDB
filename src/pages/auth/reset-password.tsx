import Layout from "src/core/layouts/Layout"
import { LabeledTextField } from "src/core/components/LabeledTextField"
import { ResetPassword } from "src/auth/schemas"
import resetPassword from "src/auth/mutations/resetPassword"
import { BlitzPage, Routes } from "@blitzjs/next"
import { useRouter } from "next/router"
import { useMutation } from "@blitzjs/rpc"
import Link from "next/link"
import { assert } from "blitz"
import { Form } from "react-final-form"
import { CMTextInputBase } from "src/core/components/CMTextField"
import { NameValuePair } from "src/core/db3/DB3Client"
import React, { Suspense } from "react";
import { Button } from "@mui/base"
import * as z from "zod"

interface Result {
  success: boolean;
  message: string;
}

const ResetPasswordPage: BlitzPage = () => {
  const router = useRouter()
  const token = router.query.token?.toString()
  const [resetPasswordMutation, mutationInfo] = useMutation(resetPassword);
  const [password, setPassword] = React.useState("");
  const [passwordConfirmation, setPasswordConfirmation] = React.useState("");
  const [result, setResult] = React.useState<Result | null>(null);

  const handleSubmit = async () => {

    try {
      ResetPassword.parse({
        password,
        passwordConfirmation,
        token,
      });

      await resetPasswordMutation({ token: token || "", password, passwordConfirmation })
      setResult({
        success: true,
        message: "", // unused
      });
    } catch (e) {
      console.log(e);
      if (e instanceof z.ZodError) {
        setResult({
          success: false,
          message: (e as any).errors[0].message,
        });
      }
      else if (e.name === "ResetPasswordError") {
        setResult({
          success: false,
          message: e.message,
        });
      } else {
        setResult({
          success: false,
          message: "Sorry, we had an unexpected error. Please try again.",
        });
      }
    }
  };

  const formDisable = mutationInfo.isLoading;

  return (
    <div className="resetPasswordPage">
      <div className="resetPasswordContent">
        {result?.success ? (
          <div>
            <h2>Password Reset Successfully</h2>
            <p>
              Go to the <a href="/backstage">backstage.</a>
            </p>
          </div>
        ) : (
          <div>
            <h1>Set a New Password</h1>

            <NameValuePair isReadOnly={formDisable} name="New password" value={
              <CMTextInputBase autoFocus={true} value={password} onChange={(e, value) => setPassword(value)} type="password" />
            } />
            <NameValuePair isReadOnly={formDisable} name="Confirm your new password" value={
              <CMTextInputBase value={passwordConfirmation} onChange={(e, value) => setPasswordConfirmation(value)} type="password" />
            } />
            <Button onClick={handleSubmit} disabled={formDisable}>Submit</Button>
            {result?.success === false && <div className="error">{result.message}</div>}
          </div>

        )}
      </div>
    </div>
  )
}

ResetPasswordPage.getLayout = (page) => <Layout title="Reset Your Password">{page}</Layout>

export default ResetPasswordPage
