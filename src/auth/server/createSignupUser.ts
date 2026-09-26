import { SecurePassword } from "@blitzjs/auth/secure-password";
import type { Ctx } from "@blitzjs/next";
import { assert } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { generatePublicId } from "src/server/publicId";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import { SignInMethodSchema } from "../signInMethodSchemas";
import { addSignInMethod, SignInMethodConflictError, signInMethodWhere } from "./signInMethods";

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
        const defaultRoles = await tx.role.findMany({
            where: { isRoleForNewUsers: true },
            select: { id: true },
            take: 2,
        });
        assert(
            defaultRoles.length === 1,
            `Expected exactly one role for new users; found ${defaultRoles.length}.`,
        );

        // A profile's contact address may be shared, but a sign-in identifier may not.
        for (const method of [emailMethod, ...(googleMethod ? [googleMethod] : [])]) {
            if (await tx.userSignInMethod.findFirst({ where: signInMethodWhere(method) })) {
                throw new SignInMethodConflictError();
            }
        }

        const data: Prisma.UserUncheckedCreateInput = {
            publicId: generatePublicId<"User">(),
            name: args.name,
            email: emailMethod.identifier,
            hashedPassword,
            isSysAdmin: false,
            roleId: defaultRoles[0]!.id,
        };
        const user = await tx.user.create({
            data,
            ...UserWithRolesArgs,
        });
        await addSignInMethod(tx, user.id, emailMethod);
        if (googleMethod) await addSignInMethod(tx, user.id, googleMethod);

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext: CreateChangeContext("signupMutation"),
            table: "User",
            pkid: user.id,
            newValues: {
                name: user.name,
                email: user.email,
                isSysAdmin: false,
                roleId: user.roleId,
                authenticationMethod: args.googleId ? "google" : "password",
            },
            ctx,
            db: tx,
        });

        return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};
