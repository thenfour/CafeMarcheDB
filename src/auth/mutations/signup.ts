import { resolver } from "@blitzjs/rpc";
import { Signup } from "../schemas";
import { CreatePublicData } from "types";
import { createSignupUser } from "../server/createSignupUser";

export default resolver.pipe(
  resolver.zod(Signup),
  async (fields, ctx) => {
    const user = await createSignupUser(fields, ctx);

    await ctx.session.$create(CreatePublicData({ user }));
    return { id: user.id, name: user.name, email: user.email };
  });
