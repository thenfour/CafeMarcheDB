import { z } from "zod"

export const email = z
  .string()
  .email()
  .transform((str) => str.toLowerCase().trim())

export const name = z
  .string()

export const googleId = z
  .string().optional()

export const password = z
  .string()
  .min(4)
  .max(100)
  .transform((str) => str.trim())

export const role = z
  .string()

export const Signup = z.object({
  email,
  password,
  name,
  googleId,
})

export const UpdateUserFromGrid = z.object({
  id: z.number(),
  email,
  name,
  role,
})

export const Login = z.object({
  email,
  password: z.string(),
})

export const ForgotPassword = z.object({
  email,
})

export const ResetPassword = z
  .object({
    password: password,
    passwordConfirmation: password,
    token: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords don't match",
    path: ["passwordConfirmation"], // set the path of the error
  })

export const ChangePassword = z.object({
  currentPassword: z.string(),
  newPassword: password,
})
