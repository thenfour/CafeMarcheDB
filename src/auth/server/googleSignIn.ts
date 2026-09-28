import type { Ctx } from "@blitzjs/next";
import { AuthenticationError } from "blitz";
import db from "db";
import { nanoid } from "nanoid";
import { SignInMethodSchema } from "../signInMethodSchemas";
import { createSignupUser } from "./createSignupUser";
import { getVerifiedGoogleProfileEmail, GoogleProfileWithEmails } from "./googleProfile";
import { findSignInUser, findSignInUserByEmailForDevAndFirstTimeInstalls } from "./signInMethods";

const recordVerifiedGoogleEmail = async (userId: number, identifier: string, email: string) => {
    await db.userSignInMethod.updateMany({
        where: {
            userId,
            type: "google",
            identifier,
            OR: [
                { displayId: null },
                {
                    displayId: { not: email }
                }
            ],
        },
        data: { displayId: email },
    });
};


// performs Google sign-in, creating a new user if necessary.
export const resolveGoogleSignIn = async (profile: GoogleProfileWithEmails, ctx: Ctx) => {
    const method = SignInMethodSchema.parse({ type: "google", identifier: profile.id });
    const existing = await findSignInUser(db, method, { allowInactive: false });
    const verifiedEmail = getVerifiedGoogleProfileEmail(profile);
    if (existing) {
        // this could be more efficient; check if it needs to be updated, use existing signin method ID...
        if (verifiedEmail) {
            await recordVerifiedGoogleEmail(existing.id, method.identifier, verifiedEmail);
        }
        return { user: existing, created: false };
    }
    if (!verifiedEmail) throw new AuthenticationError();

    const existingByEmail = await findSignInUserByEmailForDevAndFirstTimeInstalls(db, verifiedEmail, profile.id ?? null, { allowInactive: false });
    if (existingByEmail) {
        await recordVerifiedGoogleEmail(existingByEmail.id, method.identifier, verifiedEmail);
        return { user: existingByEmail, created: false };
    }

    // Signup reserves the email and subject atomically. An existing email owner
    // requires explicit Sysadmin linking, including after a method was removed.
    const user = await createSignupUser({
        name: profile.displayName || verifiedEmail,
        email: verifiedEmail,
        googleId: method.identifier,
        password: "1234567890!@#$%^&aoeuAOEU" + nanoid(),
    }, ctx);

    return { user, created: true };
};
