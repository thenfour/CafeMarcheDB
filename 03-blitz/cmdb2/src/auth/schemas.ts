import db, { Prisma } from "db";
import { z } from "zod"

// generic
export const GetObjectByNullableIdSchema = z.object({
  // allows null (and the query should probably return an empty object or null then.)
  id: z.number().nullable().optional(),
});
export const GetObjectByIdSchema = z.object({
  // This accepts type of undefined, but is required at runtime
  id: z.number().optional()/*.refine(Boolean, "Required")*/, // refine to ensure IDs are truthy. but that's only necessary when inserting?
});

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

export const Signup = z.object({
  email,
  password,
  name: name.min(1),
  googleId,
  roleId: z.number().nullable().optional(),
})

export const UpdateUserFromGrid = z.object({
  id: z.number(),
  email,
  name,
  roleId: z.number().nullable().optional(),
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

// model Role {
export const CreateRole = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const UpdateRole = z.object({
  id: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const DeleteRole = z.object({
  id: z.number(),
});

export const CreatePermission = z.object({
  name: z.string().min(1),
  description: z.string(),
});

export const UpdatePermission = z.object({
  id: z.number(),
  name: z.string().min(1),
  description: z.string(),
  sortOrder: z.number(),
  roles: z.object({
    roleId: z.number(),
    permissionId: z.number(),
  }).array(),
});

export const DeletePermission = z.object({
  id: z.number(),
});

export const ToggleRolePermission = z.object({
  association: z.object({
    id: z.number(),
    roleId: z.number(),
    permissionId: z.number(),
  }).nullable(),

  xId: z.number(), // x = column = role
  yId: z.number(), // y = row = permission
});


export const RegisterActivitySchema = z.object({
  action: z.string(), // x = column = role
  data: z.unknown(),
});

