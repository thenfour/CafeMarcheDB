import { UserEmailSchema } from "../schemas";

type GoogleProfileEmail = {
    value?: string | null;
    verified?: boolean;
};

export type GoogleProfileWithEmails = {
    id?: string | null;
    displayName?: string | null;
    emails?: readonly GoogleProfileEmail[] | null;
};

// type GooglePhoto = {
//     value?: string | null; // uri
// }

// export type GoogleProfile = {
//     id: string;
//     displayName: string;
//     name: {
//         familyName: string;
//         givenName: string;
//     };
//     emails: GoogleEmail[];
//     photos: GooglePhoto[];
// };


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
