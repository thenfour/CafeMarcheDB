// NOTE: actualy, clientcore is quite different from the other files in terms of dependency tree.
// so import this file ONLY if you need the client basic fields stuff
export * from './components/DB3ClientCore';

export * from './components/DB3ClientBasicFields';
export * from './components/DB3ClientDateRangeColumn';
export * from './components/db3ForeignSingleFieldClient';
export * from './components/DB3ClientTagsField';
export * from './components/useDB3Command';
export * from './components/useCrudTableRenderContext';
export * from './components/useCrudViewCommands';
export * from './components/useCrudViewCreate';


export * from './components/DB3CatalogFields';

// MIGRATION_RESTORE: audit-log
// Source: 6ee055895a049d6f105d775b4e2e563542f34d32:src/core/db3/DB3Client.tsx:6-6
// Reason: Legacy audit readers and JSON rendering lack scoped ownership and target-schema references.
// Restore: Restore protected audit browsing, filters, historical JSON/detail links and clipboard/Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction; retain immutable audit recording.
// Verification: Reactivate preserved audit specifications; test sysadmin/member/anonymous access, two bands, deleted references, revoked grants, redaction, filters, JSON inspection and built-browser navigation.
// SHA256: 19f41a9cbe2acef9bfee25982b95b5307bbb84c7a20e948a5a99edd03c86853d
// MIGRATION_REFERENCE_BEGIN
// export * from './components/DB3JSONStringColumnClient';
// MIGRATION_REFERENCE_END
