# User settings

`UserSetting` stores JSON values under literal names such as
`calendar.showDeclinedEvents`, unique per user. The shared registry in
`shared/userSettings.ts` owns each setting's schema and default and derives the
TypeScript types. Adding a setting requires a registry entry and its consumer/UI;
it does not require another database migration.

Reads resolve all registered settings, using defaults for absent or invalid
values and ignoring retired keys. Reads do not create rows. Both calendar
preferences default to `true`, preserving existing subscriptions.

`updateMyUserSettings` accepts a strict partial settings object. It derives the
owner from the active session, checks fresh login authorization, and saves and
audits only supplied settings in one transaction. User settings follow the active
identity during impersonation, like ordinary profile edits. Calendar bearer
credentials remain controlled by the separate subscription ownership flow.

`getDashboardData` loads all settings for its authenticated principal. Consumers
read resolved values through:

```ts
dashboardContext.userSettings["calendar.showDeclinedEvents"]
dashboardContext.userSettings["calendar.showUninvitedEvents"]
```

Dashboard query keys include the session user ID to separate account caches.
After saving, update that query's settings with the mutation result. The provider
notifies React consumers while retaining the stable runtime context instance.
The calendar feed uses the same server settings loader directly.

## Calendar attendance

`shared/eventAttendance.ts` centralizes going (`strength > 50`) and explicit
not-going classifications. Missing attendance is neither; exactly 50 is not going.

When declined events are hidden, an event is eligible if any non-cancelled
segment lacks an explicit not-going response from the subscriber. Unanswered,
cleared and TBD segment responses participate in this decision. The export then
includes every dated, non-cancelled segment of the eligible event. Cancelled
events remain excluded.

## Calendar invitations

`shared/eventInvitation.ts` resolves whether a user is invited to an event:
membership of its invitation user tag OR an individual `isInvited: true` response.
The stored individual flag adds an invitation; `false`, `null`, or a missing
response cannot override tag membership. Without an invitation tag, only
individual invitations count. The website and calendar export use this helper.

When `calendar.showUninvitedEvents` is `false`, the feed hides the whole event
unless the subscriber is invited or has an explicit going response (`strength > 50`)
on at least one non-cancelled segment. That response satisfies both calendar
preferences; unanswered or cleared responses do not override the invitation filter.
Answering "going" does not change the user's invitation status. Invitation is
business logic; it does not change event visibility or authorization on the website.
Current invitations and tag membership are evaluated on every feed request.

The same subscription URL and segment UIDs are retained. Changes become visible
when the calendar client fetches the feed again.
