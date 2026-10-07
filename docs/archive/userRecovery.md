# User recovery

`recover_users` allows viewing deactivated users and reactivating accounts within the actor's delegation authority. It is separate from `deactivate_users`. Protected accounts require Sysadmin authority; delegated recovery also checks the retained role against the actor's permission envelope.

Apply `20260913200000_user_recovery_permission` with the normal deployment migrations. It adds the permission and grants it to the designated Sysadmin role. Assign it explicitly to other roles that should manage recovery. Fresh installations include it in the default Admin role.

User search offers **Show deactivated items** inside the expandable filters, off by default. The `includeDeleted` URL state participates in filter reset and pagination. DB3 table `searchCapabilities` is the shared opt-in contract; only the users table enables recovery search. Other search pages retain their existing behavior.

Deactivated profiles remain accessible to viewers with `recover_users`, show a deactivation banner, and offer Reactivate when the target policy allows it. Deactivation redirects viewers without recovery access to user search (or the dashboard if they cannot search users). Deactivating oneself returns to the dashboard login flow.

The users grid includes `isDeleted` and deactivated rows for authorized viewers. Lifecycle edits call the same dedicated operations as profile buttons and must be saved separately from other profile edits. Reactivation preserves the account's identity, role, and relationships, clears any retained sessions, and writes an audit entry in the same transaction. Generic user deletion and restoration remain disabled.
