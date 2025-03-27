import { SecurePassword } from "@blitzjs/auth/secure-password"
import { resolver } from "@blitzjs/rpc"
import { NotFoundError } from "blitz"
import db from "db"
import { Permission } from "shared/permissions"
import { ChangePassword } from "../schemas"
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog"

//resolver.authorize is defined to take only role/roles. so i can't make my own custom resolver.authorize unfortunately,
// even though it's overridden via isAuthorized: CMDBRolesIsAuthorized.
// so the resolver.authorize() call should just be to make sure the user has a login.
// actual permissions checking to be done in code following.

export default resolver.pipe(
  resolver.zod(ChangePassword),
  resolver.authorize(Permission.login),
  async ({ currentPassword, newPassword }, ctx) => {

    const user = await db.user.findFirst({ where: { id: ctx.session.userId } })
    if (!user) throw new NotFoundError()

    // try {
    //   await authenticateUser(user.email, currentPassword)
    // } catch (error) {
    //   if (error instanceof AuthenticationError) {
    //     throw new Error("Invalid Password")
    //   }
    //   throw error
    // }

    const hashedPassword = await SecurePassword.hash(newPassword.trim());
    const oldUser = await db.user.findFirst({
      where: { id: user.id },
    });
    const newUser = await db.user.update({
      where: { id: user.id },
      data: { hashedPassword },
    })

    await RegisterChange({
      action: ChangeAction.update,
      changeContext: CreateChangeContext("changePasswordMutation"),
      table: "user",
      pkid: user.id,
      oldValues: oldUser,
      newValues: newUser,
      ctx,
    });

    return true
  }
)
