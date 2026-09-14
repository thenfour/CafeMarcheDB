import type { Ctx } from "@blitzjs/next";
import { AuthenticationError } from "blitz";
import db from "db";
import { nanoid } from "nanoid";
import { SignInMethodSchema } from "../signInMethodSchemas";
import { createSignupUser } from "./createSignupUser";
import { getVerifiedGoogleProfileEmail, GoogleProfileWithEmails } from "./googleProfile";
import { findSignInUser, findSignInUserByEmailForDevAndFirstTimeInstalls } from "./signInMethods";


// performs Google sign-in, creating a new user if necessary.
export const resolveGoogleSignIn = async (profile: GoogleProfileWithEmails, ctx: Ctx) => {
    const method = SignInMethodSchema.parse({ type: "google", identifier: profile.id });
    const existing = await findSignInUser(db, method, { allowInactive: false });
    if (existing) {
        return { user: existing, created: false };
    }
    const email = getVerifiedGoogleProfileEmail(profile);
    if (!email) throw new AuthenticationError();

    const existingByEmail = await findSignInUserByEmailForDevAndFirstTimeInstalls(db, email, profile.id ?? null, { allowInactive: false });
    if (existingByEmail) {
        return { user: existingByEmail, created: false };
    }

    // Signup reserves the email and subject atomically. An existing email owner
    // requires explicit Sysadmin linking, including after a method was removed.
    const user = await createSignupUser({
        name: profile.displayName || email,
        email,
        googleId: method.identifier,
        password: "1234567890!@#$%^&aoeuAOEU" + nanoid(),
    }, ctx);
    return { user, created: true };
};
