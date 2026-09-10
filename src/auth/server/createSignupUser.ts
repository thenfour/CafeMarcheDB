import { SecurePassword } from "@blitzjs/auth/secure-password";
import type { Ctx } from "@blitzjs/next";
import { assert } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";

export interface CreateSignupUserArgs {
    email: string;
    name: string;
    password: string;
    googleId?: string;
}

export const createSignupUser = async (args: CreateSignupUserArgs, ctx: Ctx) => {
    const defaultRoles = await db.role.findMany({
        where: { isRoleForNewUsers: true },
        select: { id: true },
        take: 2,
    });
    assert(
        defaultRoles.length === 1,
        `Expected exactly one role for new users; found ${defaultRoles.length}.`,
    );

    const data: Prisma.UserUncheckedCreateInput = {
        name: args.name,
        email: args.email.toLowerCase().trim(),
        hashedPassword: await SecurePassword.hash(args.password.trim()),
        googleId: args.googleId,
        isSysAdmin: false,
        roleId: defaultRoles[0]!.id,
    };
    const user = await db.user.create({
        data,
        ...UserWithRolesArgs,
    });

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
    });

    return user;
};
