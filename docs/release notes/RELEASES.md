# CMDB v3.0.1

Note: v3.0.0 was released as a practical test of the new CI/CD; that release
is to be ignored; v3.0.1 is considered the next production release after v2.03
(094a783a)

## Change detail

- Security / authorization
  - #669 #668 security hardening (see below)
  - #664 establish behavior for new users signing up with an email that's already in use.
  - #672 changed build / package / release / upgrade process to use docker and
    github actions rather than a ubuntu vm
  - #679 user administration page usable by band admin
  - #683 deactivated users can now be reactivated by a sysadmin
  - #292 fixed: setlists could show songs you're not allowed to see
- Text editor
  - #634 Text editor auto-height support
  - #633 Side-by-side preview mode
  - #515 Text editor full-screen mode
- Setlist planner
  - #666 fixed: changing order of rows in setlist planner de-syncs column cells
  - #670 #632 fixed: setlist plans couldn't be duplicated
  - #622 Setlist plan song indices are now 1-based (first song used to be "#0")
- details
  - #648 Add "(cancelled)" to cancelled event names in various places for clarity
  - #643 Calendar sync stuff is moved to its own page
  - #640 fixed: redundant / obvious tags no longer shown (like if you're on
    "Tango" song page, looking at the files list, we used to show "Tango" as a
    tagged song on every file. Now that redundant tag is hidden.)
  - #641 Removed ability to sort songs, events, users, files, wiki pages by "id"; improved sort column naming.
  - #623 fixed: files could not be tagged with events because the event chip could not be clicked on
  - #636 File lists no longer show sort options as chips (too many chips!)
  - #629 fixed: Setlist dialog was unexpectedly refreshing the whole page sometimes
  - #630 fixed: Setlist dialog "+break" and "+divider" were hard to click sometimes
  - #626 fixed: Song search results sometimes didn't show the footer when it was supposed to.
  - #638 Setlists now display faint value bars for BPM
  - #673 fixed: Site branding could sometimes be bypassed (favicon / error boundaries)
  - #663 Users can now have multiple signin methods (google + email/password, multiple emails...),
    and signin email can be different than displayed contact email.
  - #671 You can now hide from your calendar feed events that you responded "not going", and hide events you're not invited to.
  - #686 UI improvements / tweaks
  - #631 #684 various improvements to metronome (timing stability, edge case bugs, transition continuity)
  - #481 ability to merge duplicate user identities

## security hardening

Some small feature changes are necessary for hardening, for example:

- Split branding, user landing page such that different roles can see different things
- Calendar page introduced to allow better control and presentation of the sensitive URL
- Some features may have been revoked from non-sysadmins (password reset)
- Some files may no longer be visible due to application of security policy

Actions taken:

- Prereqs
  - BA-T001 - introduce authorization test suite / harness to verify auth policies
- DB3 hardening
  - BA-A001 - better validation of db3 CRUD requests; zero-trust at server entrypoint
  - BA-A002 - enforce query authorization at table, row, column level for all requests
  - BA-A003 - enforce mutation authorization
  - BA-A004 - enforce authorization for association changes
  - BA-A005 - enforce delete authorization
- Identity protection / delegable roles / user mgmt
  - BA-U001 - hardening around protected principles
  - BA-U002 - split out new `assign_user_roles` permission, establish delegable roles
  - BA-U003 - requires sysadmin now, due to sensitivity of the password reset link
  - BA-U004 - impersonation restricted to sysadmins
  - BA-U005 - hardening public signup mutations, introduction of one-time admin recovery system
  - BA-U006 - remove sensitive fields from all unnecessary payloads, harden User table actions
- Remove sensitive fields, object-level authorization
  - BA-S001 - Calendar feed URL is dedicated to calendar (not a generic "uid"), is less visible,
    and can be reset on demand
  - BA-S002 - File visibility authorization is now enforced
  - BA-S003 - Gaps around direct mutation (sort order, song list deletion, inconsistencies)
  - BA-S004 - Inconsistencies around wiki authorizations (applying tags versus managing tags)
  - BA-S005 - Authorization for page title generation, telemetry verification
  - BA-S006 - Soft deletion policy, row visibility, self-owned rows, auth verifications
- Cleaner permission model
  - BA-M001 - Permission registry centralized, policy enforced
- Session-level authorization and revocation
  - BA-R001 - Permission registry properly synchronized to db
  - BA-R002 - Revoke sessions when security topology changes
- Feature-level security
  - BA-C001 - Setting authorization policy applied: public visibility, per-key
    mutation (branding vs band preferences and copy vs system settings etc)
  - BA-C002 - Split brand page between `manage_site_branding` and sysadmins (for hosting mode)
  - BA-C003 - Gate technical info behind `sysadmin` permission.
- More feature-level security
  - BA-N001 - Centralized site-wide route registry
  - BA-N002 - Navigation vs menu mismatches corrections
  - BA-N003 - More routing corrections and hardening
- Preparation for Band Admin role
  - splitting permissions that mixed sysadmin and band admin capabilities
