import { AuthenticationError, NotFoundError } from "blitz";
import { Prisma } from "db";
import type { Ctx } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { UserWithRolesArgs, type UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import type { SignInMethodInput } from "../signInMethodSchemas";
import { loadAuthorization } from "./requestAuthorization";
import { db3Server } from "src/core/db3/server/db3Server";
import { xUserSignInMethod } from "src/core/db3/shared/schema/userSignInMethod";
import type { UserPublicId } from "shared/publicId";

const signInMethodServer = db3Server.table(xUserSignInMethod);

export class SignInMethodConflictError extends Error {
    constructor() {
        super("This sign-in method is already assigned to a user, possibly a deactivated user.");
        this.name = "SignInMethodConflictError";
    }
}

export const signInMethodWhere = (method: SignInMethodInput) => ({ type: method.type, identifier: method.identifier });

// Resolve ownership without filtering inactive users out of the lookup.
export const findSignInUser = async (
    db: TransactionalPrismaClient,
    method: SignInMethodInput,
    opts: { allowInactive: boolean, },
): Promise<(UserWithRolesPayload & { hashedPassword: string | null }) | null> => {
    const binding = await db.userSignInMethod.findFirst({ where: signInMethodWhere(method) });
    // General profile payloads intentionally omit credentials. Authentication
    // must request the shared hash explicitly and never expose it in RPC output.
    return binding ? db.user.findFirst({
        select: {
            ...UserWithRolesArgs.select,
            hashedPassword: true,
        },
        where: {
            id: binding.userId,
            isDeleted: opts.allowInactive ? undefined : false,
        },
    }) : null;
};

// special case for dev environment and first-time installs:
// create sysadmin special user account by matching email.
export const findSignInUserByEmailForDevAndFirstTimeInstalls = async (
    db: TransactionalPrismaClient,
    email: string,
    googleId: string | null,
    opts: { allowInactive: boolean },
): Promise<(UserWithRolesPayload & { hashedPassword: string | null }) | null> => {
    if (!googleId) {
        return null;
    }
    const binding = await db.userSignInMethod.findFirst({
        where: {
            type: "google",
            identifier: `GOOGLE_FIRST_TIME_INSTALL_USER_EMAIL:${email.toLowerCase().trim()}`
        }
    });

    if (!binding) {
        return null;
    }

    // ok we identified this one-time install special user by email.
    // the user exists but the binding needs to be set to the actual correct googleId.
    await db.userSignInMethod.update({
        where: { id: binding.id },
        data: { identifier: googleId },
    });

    return db.user.findFirst({
        select: {
            ...UserWithRolesArgs.select,
            hashedPassword: true,
        },
        where: {
            id: binding.userId,
            isDeleted: opts.allowInactive ? undefined : false,
        },
    });
};

export const requireActiveSignInUser = async (db: TransactionalPrismaClient, method: SignInMethodInput) => {
    const user = await findSignInUser(db, method, { allowInactive: false });
    if (!user) throw new AuthenticationError();
    return user;
};

export const requireSignInMethodAdmin = async (db: TransactionalPrismaClient, ctx: Ctx) => {
    const auth = await (await loadAuthorization(ctx.session)).refresh(db);
    auth.requirePermission(Permission.sysadmin);
    return auth;
};

// this explicitly allows deactivated users, because
// admins may want to deactivate a user before managing their sign-in methods
export const requireSignInMethodTarget = async (db: TransactionalPrismaClient, userId: number) => {
    const user = await db.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundError();
    return user;
};

export const requireSignInMethodTargetByPublicId = async (db: TransactionalPrismaClient, publicId: UserPublicId) => {
    const user = await db.user.findFirst({ where: { publicId } });
    if (!user) throw new NotFoundError();
    return user;
};

export const addSignInMethod = async (db: TransactionalPrismaClient, userId: number, method: SignInMethodInput) => {
    if (await db.userSignInMethod.findFirst({ where: signInMethodWhere(method) })) {
        throw new SignInMethodConflictError();
    }
    try {
        return await signInMethodServer.createWithPublicId(async publicId => (
            db.userSignInMethod.create({ data: { userId, ...method, publicId } })
        ));
    } catch (error) {
        // P2002 = "Unique constraint failed on the {constraint}"
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new SignInMethodConflictError();
        }
        throw error;
    }
};

export const revokeUserSignInState = async (db: TransactionalPrismaClient, userId: number) => {
    await db.session.deleteMany({ where: { userId } });
    await db.token.deleteMany({ where: { userId, type: "RESET_PASSWORD" } });
};

export const recordSignInMethodChange = async (
    db: TransactionalPrismaClient, ctx: Ctx, userId: number,
    method: { publicId: string; type: string }, action: "added" | "removed",
) => {
    await revokeUserSignInState(db, userId);
    await RegisterChange({
        action: ChangeAction.update,
        changeContext: CreateChangeContext("manageUserSignInMethods"),
        table: "User", pkid: userId,
        oldValues: {},
        // Keep identifiers and credentials out of the general activity log.
        newValues: { signInMethodPublicId: xUserSignInMethod.parseIdentity(method.publicId), signInMethodType: method.type, signInMethodAction: action },
        options: { dontCalculateChanges: true },
        ctx, db,
    });
};
