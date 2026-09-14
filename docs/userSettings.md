# User settings

`UserSetting` stores JSON values under literal names such as
`calendar.showDeclinedEvents`, unique per user. The shared registry in
`shared/userSettings.ts` owns each setting's schema and default and derives the
TypeScript types. Adding a setting requires a registry entry and its consumer/UI;
it does not require another database migration.

Reads resolve all registered settings, using defaults for absent or invalid
values and ignoring retired keys. Reads do not create rows. The initial calendar
preference defaults to `true`, preserving existing subscriptions.

`updateMyUserSettings` accepts a strict partial settings object. It derives the
owner from the active session, checks fresh login authorization, and saves and
audits only supplied settings in one transaction. User settings follow the active
identity during impersonation, like ordinary profile edits. Calendar bearer
credentials remain controlled by the separate subscription ownership flow.

`getDashboardData` loads all settings for its authenticated principal. Consumers
read resolved values through:

```ts
dashboardContext.userSettings["calendar.showDeclinedEvents"]
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
events remain excluded; public feeds remain inclusive.

The same subscription URL and segment UIDs are retained. Changes become visible
when the calendar client fetches the feed again.
