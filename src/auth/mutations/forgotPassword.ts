import { ServerApi } from "@/src/server/serverApi"
import { generateToken, hash256 } from "@blitzjs/auth"
import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db"
import { Permission } from "shared/permissions"
import { ForgotPassword } from "../schemas"
import { requireCanManageUser } from "../server/userManagementPolicy"
import { findSignInUser, requireSignInMethodAdmin } from "../server/signInMethods"
import { UserWithRolesArgs } from "@/src/core/db3/shared/schema/userPayloads"
import { makeUserManagementActor, makeUserManagementTarget } from "../server/userManagementState"

const RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS = 48

export default resolver.pipe(
  resolver.authorize(Permission.sysadmin),
  resolver.zod(ForgotPassword),
  async (input, ctx) => db.$transaction(async tx => {
    // Re-read effective grants before target lookup or token generation.
    const actor = await requireSignInMethodAdmin(tx, ctx)

    const user = "userId" in input
      ? (await tx.user.findFirst({
        select: { ...UserWithRolesArgs.select },
        where: { id: input.userId }
      }))
      : (await findSignInUser(tx, { type: "email", identifier: input.email }, { allowInactive: false }))
    if (user) {
      requireCanManageUser({
        actor: makeUserManagementActor(actor, actor.effectivePermissions),
        target: makeUserManagementTarget(user),
        action: "resetPassword",
      })
    }

    // 2. Generate the token and expiration date.
    const token = generateToken()
    const hashedToken = hash256(token)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS)

    // 3. If user with this email was found
    if (user) {
      // 4. Delete any existing password reset tokens
      await tx.token.deleteMany({ where: { type: "RESET_PASSWORD", userId: user.id } })
      // 5. Save this new token in the database.
      await tx.token.create({
        data: {
          userId: user.id,
          type: "RESET_PASSWORD",
          expiresAt,
          hashedToken,
          sentTo: user.email,
        },
      })

    } else {
      // 7. If no user found wait the same time so attackers can't tell the difference
      await new Promise((resolve) => setTimeout(resolve, 750))
    }

    // 8. Return the same result whether a password reset email was sent or not

    const resetUrl = ServerApi.getAbsoluteUri(`/auth/reset-password?token=${token}`);
    return resetUrl;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }))
