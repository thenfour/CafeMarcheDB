import { SecurePassword } from "@blitzjs/auth/secure-password";
import type { Ctx } from "@blitzjs/next";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "@/src/auth/server/activityLog";
import { generatePublicId } from "src/server/publicId";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import { SignInMethodSchema } from "../signInMethodSchemas";
import { addSignInMethod, SignInMethodConflictError, signInMethodWhere } from "./signInMethods";
import { loadAuthorization } from "./serverAuthorization";
import { platformScope } from "./authorizationContext";

export interface CreateSignupUserArgs {
    email: string;
    name: string;
    password: string;
    googleId?: string;
}

export const createSignupUser = async (args: CreateSignupUserArgs, ctx: Ctx) => {

    const emailMethod = SignInMethodSchema.parse({ type: "email", identifier: args.email });
    const googleMethod = args.googleId === undefined ? null
        : SignInMethodSchema.parse({ type: "google", identifier: args.googleId });

    const hashedPassword = await SecurePassword.hash(args.password.trim());

    return db.$transaction(async tx => {
        const methodsDesired = [emailMethod, ...(googleMethod ? [googleMethod] : [])];

        // as we are creating a new user, only pass if there are no signin conflicts with
        // existing users. and don't reveal which specific method is causing the conflict.
        for (const method of methodsDesired) {
            const existing = await tx.userSignInMethod.findFirst({ where: signInMethodWhere(method) });
            if (existing) {
                throw new SignInMethodConflictError();
            }
        }

        const data: Prisma.UserUncheckedCreateInput = {
            publicId: generatePublicId<"User">(),
            name: args.name,
            email: emailMethod.identifier,
            hashedPassword,
            isSysAdmin: false,
            globalRoleId: null,
        };
        const user = await tx.user.create({
            data,
            ...UserWithRolesArgs,
        });

        // oauth methods still get an email signin method (but they would need to change their password)
        await addSignInMethod(tx, user.id, emailMethod, emailMethod.identifier);
        if (googleMethod) {
            await addSignInMethod(tx, user.id, googleMethod, emailMethod.identifier);
        }

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext: CreateChangeContext("signupMutation"),
            table: "User",
            pkid: user.id,
            newValues: {
                name: user.name,
                email: user.email,
                isSysAdmin: false,
                globalRoleId: user.globalRoleId,
                authenticationMethod: args.googleId ? "google" : "password",
            },
            auth: await loadAuthorization(ctx.session, platformScope),
            db: tx,
        });

        return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};
