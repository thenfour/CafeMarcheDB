export * from "./shared/entities/event/eventTagCatalogs";
export * from "./shared/entities/file/fileTagCatalogs";
export * from "./shared/schema/prismArgs"

export * from "./shared/db3core"
export * from "./shared/columnTypes/xTableColumnTypes"
export * from "./shared/core/db3Hydration"
export * from "./shared/core/db3View"
export * from "./shared/core/db3ViewContract"
export * from "./shared/core/db3Command"
export * from "./shared/core/db3AssociationCommand"
export * from "./shared/core/db3EntityCrud"
export * from "./shared/core/db3CrudView"
export * from "./shared/references/dashboardReferences"

export * from "./shared/schema/instrument"
export * from "./shared/schema/user"
export * from "./shared/schema/userSignInMethod"
export * from "./shared/schema/song"
export * from "./shared/schema/event"
export * from "./shared/schema/file"
export * from "./shared/schema/customLinks"
export * from "./shared/schema/wiki"
export * from "./shared/schema/wikiPageTag"
export * from "./shared/schema/menuLink"
export * from "./shared/schema/setlistPlan"
export * from "./shared/entities/instrument/instrumentViews"
export * from "./shared/entities/instrument/bandInstrumentContracts"
export * from "./shared/entities/file/fileViews"
export * from "./shared/entities/file/fileSearchView"
export * from "./shared/entities/file/galleryCommands"
export * from "./shared/entities/song/songViews"
export * from "./shared/entities/song/songHistory"
export * from "./shared/entities/event/eventStatistics"
export * from "./shared/entities/song/bandSongTagViews"
export * from "./shared/entities/user/userViews"
export * from "./shared/entities/user/bandPersonReference"
export * from "./shared/entities/user/platformUser"
export * from "./shared/entities/user/bandUserInstruments"
export * from "./shared/entities/user/eventParticipant"
export * from "./shared/entities/user/bandUser"
export * from "./shared/entities/user/bandUserTags"
export * from "./shared/entities/user/bandUserRoles"
export * from "./shared/entities/user/bandUserProfile"
export * from "./shared/entities/user/bandUserSearchView"
export * from "./shared/entities/user/bandUserLifecycle"
export * from "./shared/entities/user/bandRoleViews"
export * from "./shared/entities/user/roleViews"
export * from "./shared/entities/user/rolePermissionCommands"
export * from "./shared/entities/user/bandUserTagViews"
export * from "./shared/entities/user/userSignInMethodViews"
export * from "./shared/entities/user/permissionViews"
export * from "./shared/entities/user/userTagViews"
export * from "./shared/entities/wikiPageTag/wikiPageTagViews"
export * from "./shared/entities/wiki/wikiViews"
export * from "./shared/entities/event/eventViews"
export * from "./shared/entities/event/publicFeedViews"
export * from "./shared/entities/eventSongList/eventSongListContent"
export * from "./shared/entities/eventSongList/eventSongListCommands"
export * from "./shared/entities/eventSongList/eventSongListDraft"
export * from "./shared/entities/eventSongList/eventSongListClipboard"
export * from "./shared/entities/eventSongList/eventSongListViews"
export * from "./shared/entities/setlistPlan/setlistPlanViews"
export * from "./shared/entities/customLink/customLinkViews"
export * from "./shared/entities/menuLink/menuLinkViews"
export * from "./shared/entities/menuLink/menuLinkCommands"
export * from "./shared/references/dashboardData"



// MIGRATION_RESTORE: audit-log
// Source: 6ee055895a049d6f105d775b4e2e563542f34d32:src/core/db3/db3.ts:24-24
// Reason: Legacy audit readers and JSON rendering lack scoped ownership and target-schema references.
// Restore: Restore protected audit browsing, filters, historical JSON/detail links and clipboard/Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction; retain immutable audit recording.
// Verification: Reactivate preserved audit specifications; test sysadmin/member/anonymous access, two bands, deleted references, revoked grants, redaction, filters, JSON inspection and built-browser navigation.
// SHA256: 8e969d1b00946cab4dac0cee4e6ddbea30c41fd429548f27d41771afc4879242
// MIGRATION_REFERENCE_BEGIN
// export * from "./shared/schema/admin"
// MIGRATION_REFERENCE_END
