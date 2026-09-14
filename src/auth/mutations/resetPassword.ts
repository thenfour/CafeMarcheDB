import { hash256 } from "@blitzjs/auth";
import { SecurePassword } from "@blitzjs/auth/secure-password";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { ResetPassword } from "../schemas";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import { createPublicDataFromDatabase } from "../server/effectivePermissions";
import { revokeUserSignInState } from "../server/signInMethods";

export class ResetPasswordError extends Error {
  name = "ResetPasswordError";
  message = "Reset password link is invalid or it has expired.";
}

export default resolver.pipe(
  resolver.zod(ResetPassword),
  async ({ password, token }, ctx) => {
    const hashedToken = hash256(token);
    const hashedPassword = await SecurePassword.hash(password);
    const user = await db.$transaction(async tx => {
      const savedToken = await tx.token.findFirst({ where: { hashedToken, type: "RESET_PASSWORD" } });
      if (!savedToken || savedToken.expiresAt < new Date()) throw new ResetPasswordError();
      const target = await tx.user.findFirst({ where: { id: savedToken.userId, isDeleted: false } });
      if (!target) throw new ResetPasswordError();
      // The token belongs to the user ID. Contact email is never an auth lookup.
      const updated = await tx.user.update({
        ...UserWithRolesArgs, where: { id: target.id }, data: { hashedPassword },
      });
      await revokeUserSignInState(tx, target.id);
      await RegisterChange({
        action: ChangeAction.update,
        changeContext: CreateChangeContext("resetPasswordMutation"),
        table: "User", pkid: target.id,
        oldValues: {}, newValues: { passwordReset: true },
        ctx, db: tx, options: { dontCalculateChanges: true },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    // Preserve the existing automatic sign-in after a successful password reset.
    await ctx.session.$create(await createPublicDataFromDatabase(db, { user }));
    return true;
  },
);
