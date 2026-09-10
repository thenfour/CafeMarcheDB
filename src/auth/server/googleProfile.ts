import { UserEmailSchema } from "../schemas";

type GoogleProfileEmail = {
    value?: string | null;
    verified?: boolean;
};

type GoogleProfileWithEmails = {
    emails?: readonly GoogleProfileEmail[] | null;
};

// passport-google-oauth20 maps Google's email_verified claim onto the
// normalized email entry. Fail closed if the claim or a valid address is
// missing; an unverified provider address must never be used to link or create
// a local authentication identity.
export const getVerifiedGoogleProfileEmail = (
    profile: GoogleProfileWithEmails,
): string | null => {
    const candidate = profile.emails?.find(email => email.verified === true)?.value;
    if (!candidate) return null;

    const parsed = UserEmailSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
};

// Email fallback may claim only a local account that has never been linked to
// another Google subject. A conflicting link must fail instead of being
// silently replaced.
export const getGoogleEmailLinkCandidateWhere = (email: string) => ({
    AND: [
        { email },
        { googleId: null },
        { isDeleted: false },
    ],
});
