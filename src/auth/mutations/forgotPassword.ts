import { ServerApi } from "@/src/server/serverApi"
import { generateToken, hash256 } from "@blitzjs/auth"
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads"
import { ForgotPassword } from "../schemas"
import { requireCanManageUser } from "../server/userManagementPolicy"

const RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS = 48

export default resolver.pipe(
  resolver.zod(ForgotPassword),
  resolver.authorize(Permission.manage_users),
  async ({ email }, ctx) => {
    // Use fresh database state in addition to the session authorization above,
    // so a stale grant cannot expose an account-takeover credential.
    const [actor, user] = await Promise.all([
      db.user.findFirst({
        ...UserWithRolesArgs,
        where: { id: ctx.session.userId },
      }),
      db.user.findFirst({
        ...UserWithRolesArgs,
        where: { email: email.toLowerCase() },
      }),
    ])
    if (user) {
      requireCanManageUser({ actor, target: user, action: "resetPassword" })
    }

    // 2. Generate the token and expiration date.
    const token = generateToken()
    const hashedToken = hash256(token)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS)

    // 3. If user with this email was found
    if (user) {
      // 4. Delete any existing password reset tokens
      await db.token.deleteMany({ where: { type: "RESET_PASSWORD", userId: user.id } })
      // 5. Save this new token in the database.
      await db.token.create({
        data: {
          user: { connect: { id: user.id } },
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
  })
