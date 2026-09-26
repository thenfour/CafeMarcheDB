// encapsulates the policy for invite
// called by
// - ical (server-side, using internal IDs)
// - event invitation-related components (client, using public ID)

// Invitation is event-level business logic, independent of attendance and visibility.
// The stored isInvited flag adds an individual invitation; false/null cannot
// override membership of the event's invitation tag (#162).
export const isUserInvitedToEvent = <TUserId extends number | string>(args: {
    userId: TUserId;
    defaultInvitationUserIds: ReadonlySet<TUserId>;
    responses: readonly { userId: TUserId; isInvited: boolean | null }[];
}): boolean => {

    // callers pass in the default invitation list -- typically the event's invited user tag membership
    if (args.defaultInvitationUserIds.has(args.userId)) {
        return true;
    }

    // explicit invitation is expressed as an event-user association with isInvited = true
    return args.responses.some(response => response.userId === args.userId && response.isInvited === true);
};
