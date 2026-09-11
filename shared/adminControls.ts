export type AdminControlSession = {
    isSysAdmin?: boolean | null;
    showAdminControls?: boolean | null;
};

// Technical controls require both an explicit user preference and the
// concrete User.isSysAdmin session flag. Role permissions are not accepted.
export const shouldShowAdminControls = (session: AdminControlSession | null | undefined): boolean =>
    session?.isSysAdmin === true && session.showAdminControls === true;
