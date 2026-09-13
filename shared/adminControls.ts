export type AdminControlSession = {
    permissionNames?: string[] | null;
    showAdminControls?: boolean | null;
};

// Technical controls require both the Sysadmin capability and an explicit
// user preference.
export const shouldShowAdminControls = (session: AdminControlSession | null | undefined): boolean =>
    session?.permissionNames?.includes("sysadmin") === true && session.showAdminControls === true;
