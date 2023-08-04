import { SecurePassword } from "@blitzjs/auth/secure-password";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Signup } from "../schemas";
import { CreatePublicData } from "types";
import utils, { ChangeAction, CreateChangeContext } from "shared/utils"

type CreateInput = Prisma.UserCreateInput & {
  password?: string;
};

export default resolver.pipe(
  resolver.zod(Signup),
  async (fields: CreateInput, ctx: any) => {
    fields.hashedPassword = await SecurePassword.hash(fields.password?.trim());
    delete fields.password;
    fields.email = fields.email.toLowerCase().trim();
    fields.isSysAdmin = (fields.email == process.env.ADMIN_EMAIL);
    try {
      const user = await db.user.create({
        data: fields,
        include: { role: { include: { permissions: { include: { permission: true } } } } }
      });


      await utils.RegisterChange({
        action: ChangeAction.insert,
        changeContext: CreateChangeContext("signupMutation"),
        table: "user",
        pkid: user.id,
        newValues: user,
        ctx,
      });

      await ctx.session.$create(CreatePublicData(user));
      return user;

    } catch (e) {
      console.error(`Exception while creating user`);
      console.error(e);
      throw (e);
    }
  });
