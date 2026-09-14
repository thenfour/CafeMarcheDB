# User sign-in methods

`UserSignInMethod` owns all current email and Google login identifiers. Email aliases share `User.hashedPassword`. Google identifiers are the existing `googleId` values, which Passport obtains from Google's `sub` claim. `User.email` is now a non-unique contact/display address and cannot authenticate or link an account.

Sysadmins can open **Sign-in methods** on a user's profile to list, add, or remove methods, including on deactivated users. These are administrative ownership assertions, not email verification. Mutations fresh-check Sysadmin permission, audit method IDs/types without retaining identifiers, and revoke the target's sessions and password-reset tokens transactionally. Generic User mutations cannot change methods.

Deactivation preserves all method reservations. Reactivation restores access through the remaining methods without reclaiming released identifiers. Removing a method explicitly frees it for another user or a fresh signup. An active user must retain a usable method (a Google identity or an email with a password).

The existing login/signup screens remain in place. A recognized Google subject signs into its owner regardless of changes to the provider's email. An unknown subject requires a verified provider email for signup; if that email is already reserved, a Sysadmin must explicitly attach the subject to the intended user. There is no automatic email-based Google linking. Removing a Google method therefore cannot silently recreate it through email fallback.

Password reset changes the shared user password. The profile's reset control targets the user ID; email-based reset requests resolve sign-in aliases. Reset completion signs in the token's user directly, never a user found by contact email. Administrator bootstrap similarly checks the configured email's sign-in ownership.

## Migration

1. Back up the database and stop application writers for the migration.
2. Run `node scripts/check-sign-in-migration.cjs` against the intended database. It is read-only, loads the usual environment files, and reports only user IDs for invalid or conflicting identifiers. Resolve every reported issue, including duplicates owned by deactivated users.
3. Apply `20260914000000_user_sign_in_methods` through normal Prisma deployment migrations and regenerate the Prisma client before starting the new application version.

The migration preserves user IDs, password hashes, roles, and relationships. It copies normalized emails and unchanged Google subjects before dropping `User.googleId` and the contact email uniqueness constraint. Google subjects use binary collation for case-sensitive uniqueness. It deliberately fails on duplicate ownership rather than silently choosing an account.

MySQL DDL is not transactional. If a copy fails, the old User columns remain intact, but the new table may be partially populated. Stop writers, resolve the data problem, remove only that partial `UserSignInMethod` table, mark the failed migration rolled back using Prisma's migration recovery procedure, and rerun it. Do not drop the new table after a successful migration.
