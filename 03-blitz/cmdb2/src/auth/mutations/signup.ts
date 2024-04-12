import { SecurePassword } from "@blitzjs/auth/secure-password";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Signup } from "../schemas";
import { CreatePublicData } from "types";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"

type CreateInput = Prisma.UserUncheckedCreateInput & {
  password?: string;
};

export default resolver.pipe(
  resolver.zod(Signup),
  async (fields: CreateInput, ctx: any) => {
    fields.hashedPassword = await SecurePassword.hash(fields.password?.trim());
    delete fields.password;
    fields.email = fields.email.toLowerCase().trim();
    fields.isSysAdmin = (fields.email == process.env.ADMIN_EMAIL);

    const role = await db.role.findFirst({
      where: {
        isRoleForNewUsers: true
      }
    });

    if (role) {
      fields.roleId = role.id;
    }

    try {
      const user = await db.user.create({
        data: fields,
        include: { role: { include: { permissions: { include: { permission: true } } } } }
      });


      await RegisterChange({
        action: ChangeAction.insert,
        changeContext: CreateChangeContext("signupMutation"),
        table: "user",
        pkid: user.id,
        newValues: user,
        ctx,
      });

      await ctx.session.$create(CreatePublicData({ user }));
      return user;

    } catch (e) {
      console.error(`Exception while creating user`);
      console.error(e);
      throw (e);
    }
  });
